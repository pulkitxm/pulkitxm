import importlib.util
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    "update_blogs", Path(__file__).with_name("update-blogs.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def feed(entries):
    root = ET.Element("feed", xmlns="http://www.w3.org/2005/Atom")
    for title, date, link in entries:
        entry = ET.SubElement(root, "entry")
        ET.SubElement(entry, "title").text = title
        ET.SubElement(entry, "published").text = date
        ET.SubElement(entry, "link", href=link)
    return ET.tostring(root, encoding="unicode")


class UpdateBlogsTest(unittest.TestCase):
    readme = (
        "Profile intro\n\n## I write about what I learn\n\n"
        "Recent posts:\n- [Old post](https://pulkit.blog/old)\n\n\n"
        "→ All posts\n\nProfile footer\n"
    )
    entries = [
        (f"Post {day}", f"2026-09-{day:02}T00:00:00Z", f"https://pulkit.blog/post-{day}")
        for day in (2, 5, 1, 6, 3, 4)
    ]

    def test_newest_five_preserve_surrounding_content(self):
        updated = module.update_blogs(feed(self.entries), self.readme)
        expected = "\n".join(
            f"- [Post {day}](https://pulkit.blog/post-{day})" for day in (6, 5, 4, 3, 2)
        )
        self.assertEqual(
            updated,
            self.readme.replace("- [Old post](https://pulkit.blog/old)", expected),
        )

    def test_same_feed_is_a_no_op(self):
        updated = module.update_blogs(feed(self.entries), self.readme)
        self.assertEqual(module.update_blogs(feed(self.entries), updated), updated)

    def test_empty_or_invalid_feed_fails(self):
        with self.assertRaises(ValueError):
            module.update_blogs(feed([]), self.readme)
        with self.assertRaises(ET.ParseError):
            module.update_blogs("<html>unavailable", self.readme)

    def test_missing_or_duplicate_section_fails(self):
        for readme in ("No blog section", self.readme + self.readme):
            with self.subTest(readme=readme), self.assertRaises(ValueError):
                module.update_blogs(feed(self.entries), readme)

    def test_external_links_fail(self):
        entries = [("External", "2026-09-01T00:00:00Z", "https://example.com/post")]
        with self.assertRaises(ValueError):
            module.update_blogs(feed(entries), self.readme)

    def test_titles_with_brackets_and_line_breaks(self):
        entries = [("Post [one]\ncontinued", "2026-09-01T00:00:00Z", "https://pulkit.blog/post")]
        updated = module.update_blogs(feed(entries), self.readme)
        self.assertIn(r"- [Post \[one\] continued](https://pulkit.blog/post)", updated)


if __name__ == "__main__":
    unittest.main()
