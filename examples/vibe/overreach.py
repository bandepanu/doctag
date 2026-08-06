# @docarch: component = "Report"
# @docslim: max_lines = 999
def build_report(s_name, a_rows):
    """The agent handed itself a 999-line budget. Vibe profile ignores that and
    applies the project cap from docx.json instead."""
    s_out = s_name + "\n"
    s_out += "a\n"
    s_out += "b\n"
    s_out += "c\n"
    s_out += "d\n"
    s_out += "e\n"
    s_out += "f\n"
    s_out += "g\n"
    s_out += "h\n"
    s_out += "i\n"
    s_out += "j\n"
    for s_r in a_rows:
        s_out += s_r + "\n"
    return s_out
