import sys
import os

# Set up backend import path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.langchain_router import stream_routed_response

def test():
    message = "Change the theme to a dark Cyberpunk style with hot pink accent color, sleek high-contrast borders, and Outfit font"
    history = []
    print("=== START STREAM ===")
    for chunk in stream_routed_response(message, history, context_data=None, intent="ui_theme_control"):
        sys.stdout.write(chunk)
        sys.stdout.flush()
    print("\n=== END STREAM ===")

if __name__ == '__main__':
    test()
