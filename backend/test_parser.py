import sys
import os
import json
import re as _re

# Set up backend import path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routers.chat import extract_json_commands

def parse_stream_buffer(buf: str, is_final: bool = False):
    actions = []
    while True:
        json_blocks = extract_json_commands(buf)
        if not json_blocks:
            break
        block_str, parsed_dict = json_blocks[0]
        start_idx = buf.find(block_str)
        if start_idx == -1:
            break
        end_idx = start_idx + len(block_str)
        
        prefix = buf[:start_idx]
        suffix = buf[end_idx:]
        
        prefix_match = _re.search(r"```ui_command\s*$", prefix)
        suffix_match = _re.match(r"^\s*```", suffix)
        
        if prefix_match and not suffix_match and not is_final:
            break
            
        del_start = start_idx
        del_end = end_idx
        
        if prefix_match:
            del_start = prefix_match.start()
        if suffix_match:
            del_end = end_idx + suffix_match.end()
            
        actions.append(parsed_dict)
        buf = buf[:del_start] + buf[del_end:]
    return buf, actions

def test():
    sample = """I'll change the UI to a dark Cyberpunk theme with a hot pink accent color, sleek high-contrast borders, and the Outfit font. Here's the new look:

```ui_command
{"action": "apply_css", "vars": {
  "--bg-base": "#0a0a0f", 
  "--surface": "#111116", 
  "--surface-2": "#18181f", 
  "--accent": "#ff69b4", 
  "--accent-hover": "#ff33cc",
  "--text-base": "#e2e8f0", 
  "--text-muted": "#94a3b8", 
  "--border": "rgba(255,255,255,0.08)",
  "--font-size-base": "16px",
  "--font-family": "Outfit"
}}
```

Enjoy your new Cyberpunk-themed dashboard!"""

    print("=== RAW SAMPLE ===")
    print(sample)
    print("==================")
    
    extracted = extract_json_commands(sample)
    print(f"extract_json_commands count: {len(extracted)}")
    for i, (block, val) in enumerate(extracted):
        print(f"Block {i}: {block!r} -> {val}")
        
    buf, actions = parse_stream_buffer(sample, is_final=True)
    print(f"parse_stream_buffer actions count: {len(actions)}")
    print(f"Remaining buffer:\n{buf}")

if __name__ == '__main__':
    test()
