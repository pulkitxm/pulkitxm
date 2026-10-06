import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse


def update_blogs(feed, readme):
    namespace = {"atom": "http://www.w3.org/2005/Atom"}
    entries = ET.fromstring(feed).findall("atom:entry", namespace)
    if not entries:
        raise ValueError("The blog feed contains no entries")
    entries.sort(
        key=lambda entry: datetime.fromisoformat(
            entry.findtext("atom:published", namespaces=namespace).replace("Z", "+00:00")
        ),
        reverse=True,
    )
    blogs = []
    for entry in entries[:5]:
        title = entry.findtext("atom:title", namespaces=namespace)
        link = next(
            link.attrib["href"]
            for link in entry.findall("atom:link", namespace)
            if link.get("rel", "alternate") == "alternate"
        )
        url = urlparse(link)
        if not title or url.scheme != "https" or url.netloc != "pulkit.blog":
            raise ValueError("The blog feed contains an invalid title or link")
        title = " ".join(title.split()).replace("[", "\\[").replace("]", "\\]")
        blogs.append(f"- [{title}]({link})")
    pattern = r"(## I write about what I learn\n\n[^\n]+\n)(?:- \[[^\n]+\n)+(?=\n)"
    updated, count = re.subn(pattern, lambda match: match[1] + "\n".join(blogs) + "\n", readme)
    if count != 1:
        raise ValueError("Expected exactly one latest blog list in README.md")
    return updated


if __name__ == "__main__":
    feed_path, readme_path = map(Path, sys.argv[1:])
    updated = update_blogs(feed_path.read_text(), readme_path.read_text())
    readme_path.write_text(updated)
