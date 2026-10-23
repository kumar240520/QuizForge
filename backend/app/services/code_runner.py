import sys
import json
import re
import time
import inspect
import io

def run():
    try:
        raw_in = sys.stdin.read()
        if not raw_in.strip():
            sys.exit(0)
        data = json.loads(raw_in)
    except Exception as e:
        print(json.dumps({"passed": False, "actual_output": "", "error": f"Invalid runner payload: {str(e)}", "stdout": ""}))
        sys.exit(0)

    user_code = data.get("code", "")
    tc_input = str(data.get("input", "")).strip()
    tc_expected = str(data.get("expected_output", "")).strip()
    expected_fn = data.get("expected_fn", "")

    # Capture stdout during user execution
    stdout_capture = io.StringIO()
    old_stdout = sys.stdout

    start_time = time.time()
    user_globals = {"__name__": "__main__"}
    passed = False
    actual_out = ""
    err_msg = None

    try:
        sys.stdout = stdout_capture
        # Execute user code definitions
        exec(user_code, user_globals)

        # 1. Identify candidate functions in user_globals
        candidate_fns = []
        for name, obj in user_globals.items():
            if callable(obj) and not name.startswith("_") and getattr(obj, "__module__", None) in ("__main__", None):
                candidate_fns.append((name, obj))

        target_fn = None
        if expected_fn and expected_fn in user_globals and callable(user_globals[expected_fn]):
            target_fn = user_globals[expected_fn]
        elif candidate_fns:
            sol = [fn for name, fn in candidate_fns if name == 'solution']
            if sol:
                target_fn = sol[0]
            else:
                target_fn = candidate_fns[-1][1]

        if target_fn and tc_input:
            # Format input arguments:
            # Handle comma separated variable assignments: "nums = [1, 2], target = 8" -> lines
            pattern = re.compile(r",\s*(?=[a-zA-Z_]\w*\s*=)")
            assignment_lines = pattern.split(tc_input)
            formatted_input = "\n".join(assignment_lines)

            input_scope = {}
            try:
                exec(formatted_input, {}, input_scope)
            except Exception:
                try:
                    parsed_val = json.loads(tc_input)
                    input_scope = {"arg": parsed_val}
                except Exception:
                    pass

            sig = inspect.signature(target_fn)
            kwargs = {}
            for param_name in sig.parameters.keys():
                if param_name in input_scope:
                    kwargs[param_name] = input_scope[param_name]

            if len(kwargs) == len(sig.parameters) and len(kwargs) > 0:
                ret = target_fn(**kwargs)
            elif input_scope:
                ret = target_fn(*list(input_scope.values()))
            else:
                ret = target_fn()

            # Format return value
            if isinstance(ret, bool):
                actual_out = "True" if ret else "False"
            elif ret is None:
                actual_out = "None"
            else:
                try:
                    actual_out = json.dumps(ret)
                except Exception:
                    actual_out = str(ret)
        else:
            # No function called or no input; check stdout from script execution
            printed = stdout_capture.getvalue().strip()
            if printed:
                actual_out = printed

    except Exception as e:
        import traceback
        err_msg = traceback.format_exc().strip()
        # Take the last line of traceback for cleaner summary
        lines = err_msg.splitlines()
        summary = lines[-1] if lines else str(e)
        err_msg = summary
    finally:
        sys.stdout = old_stdout

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    printed_logs = stdout_capture.getvalue().strip()

    # Normalize comparison between actual_out and tc_expected
    if not err_msg:
        # 1. Exact string match
        if actual_out.strip() == tc_expected.strip():
            passed = True
        # 2. Case insensitive boolean/null match
        elif actual_out.strip().lower() == tc_expected.strip().lower():
            passed = True
        # 3. JSON equivalence match (e.g. "[1, 3]" vs "[1,3]" or [1, 3] vs (1, 3))
        else:
            try:
                parsed_act = json.loads(actual_out)
                parsed_exp = json.loads(tc_expected)
                passed = (parsed_act == parsed_exp)
            except Exception:
                # Number float comparison
                try:
                    passed = abs(float(actual_out) - float(tc_expected)) < 1e-6
                except Exception:
                    passed = False

    result = {
        "passed": passed,
        "input": tc_input,
        "expected_output": tc_expected,
        "actual_output": actual_out,
        "error": err_msg,
        "execution_time_ms": elapsed_ms,
        "stdout": printed_logs
    }
    print(json.dumps(result))

if __name__ == "__main__":
    run()
