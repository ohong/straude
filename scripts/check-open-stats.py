"""Check the capture timestamp served to visitors of /open."""

import sys
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser


class CaptureTime(HTMLParser):
    captured_at = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "time" and "data-open-stats-capture" in attrs:
            self.captured_at = attrs.get("datetime")


page = CaptureTime()
page.feed(sys.stdin.read())
timestamp = page.captured_at
if not timestamp:
    sys.exit("The public statistics page has no snapshot timestamp.")

captured_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
age = datetime.now(timezone.utc) - captured_at
if not timedelta(0) <= age <= timedelta(hours=48):
    sys.exit(f"The public statistics snapshot is outside the 48-hour window: {timestamp}")

print(f"The public statistics snapshot was captured at {timestamp}.")
