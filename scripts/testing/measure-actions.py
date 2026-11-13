"""Collect public GitHub Actions step timestamps; no API token, logs or private artifacts.

python scripts/testing/measure-actions.py output.json RUN_ID [RUN_ID ...]
"""
import concurrent.futures
import datetime
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import urllib.request

BASE = "https://github.com/morothon-no/historikk/actions/runs/"


def get(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def seconds(start, end):
    if not start or not end:
        return None
    return (datetime.datetime.fromisoformat(end.replace("Z", "+00:00")) -
            datetime.datetime.fromisoformat(start.replace("Z", "+00:00"))).total_seconds()


class Steps(HTMLParser):
    def __init__(self):
        super().__init__()
        self.steps = []

    def handle_starttag(self, tag, attrs):
        if tag != "check-step":
            return
        a = dict(attrs)
        self.steps.append({"name": a.get("data-name"), "conclusion": a.get("data-conclusion"),
                           "startedAt": a.get("data-started-at"),
                           "completedAt": a.get("data-completed-at"),
                           "seconds": seconds(a.get("data-started-at"), a.get("data-completed-at"))})


def collect(run_id):
    if not re.fullmatch(r"[0-9]+", run_id):
        raise ValueError("Run IDs must be numeric")
    url = BASE + run_id
    page = get(url)
    summary = page.split('aria-label="Workflow run summary"', 1)[1].split('aria-label="Workflow run graph"', 1)[0]
    text = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", summary)).split())
    duration = re.search(r"Total duration ((?:[0-9]+h )?(?:[0-9]+m )?[0-9]+s)", text)
    status = re.search(r"Status (.*?) Total duration", text)
    jobs = list(dict.fromkeys(re.findall(r"/actions/runs/" + run_id + r"/job/([0-9]+)", page)))

    def job(job_id):
        job_url = url + "/job/" + job_id
        parser = Steps()
        parser.feed(get(job_url))
        starts = [s["startedAt"] for s in parser.steps if s["startedAt"]]
        ends = [s["completedAt"] for s in parser.steps if s["completedAt"]]
        return {"id": job_id, "url": job_url, "stepSpanSeconds": seconds(min(starts), max(ends)) if starts and ends else None,
                "steps": parser.steps}

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        details = list(pool.map(job, jobs))
    return {"id": run_id, "url": url, "status": status.group(1) if status else None,
            "totalDuration": duration.group(1) if duration else None, "jobs": details}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    result = {"collectedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "source": "Public Actions HTML and check-step timestamps; no job logs downloaded",
              "runs": [collect(i) for i in sys.argv[2:]]}
    Path(sys.argv[1]).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for run in result["runs"]:
        print(run["id"], run["status"], run["totalDuration"])
