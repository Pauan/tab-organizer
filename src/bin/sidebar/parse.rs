use tab_organizer::RegExp;
use Tab;


pub(crate) struct Parsed {
    pattern: Vec<RegExp>,
}

impl Parsed {
    pub(crate) fn new(input: &str) -> Self {
        Self {
            pattern: input.split(" ")
                .filter(|x| *x != "")
                .map(|x| RegExp::new(&RegExp::escape(x), "i"))
                .collect(),
        }
    }

    pub(crate) fn matches(&self, input: &str) -> bool {
        self.pattern.iter().all(|pattern| pattern.is_match(input))
    }

    pub(crate) fn matches_tab(&self, tab: &Tab) -> bool {
        let title = tab.title.lock_ref();
        let url = tab.url.lock_ref();

        // TODO make this more efficient ?
        let title = title.as_ref().map(|x| x.as_str()).unwrap_or("");
        let url = url.as_ref().map(|x| x.as_str()).unwrap_or("");

        self.matches(title) || self.matches(url)
    }
}


#[cfg(test)]
mod tests {
    #[test]
    fn parse() {
        let parsed = super::Parsed::new("foo.\\d\\D\\w\\W\\s\\S\\t\\r\\n\\v\\f[\\b]\\0\\cM\\x00\\u0000\\u{0000}\\u{00000}\\\\[xyz][a-c][^xyz][^a-c]x|y^$\\b\\B(x)\\1(?:x)x*x+x?x{5}x{5,}x{5,6}x*?x+?x??x{5}?x{5,}?x{5,6}?x(?=y)x(?!y)bar");

        assert!(parsed.pattern.len() == 1);
        assert!(parsed.matches("foo.\\d\\D\\w\\W\\s\\S\\t\\r\\n\\v\\f[\\b]\\0\\cM\\x00\\u0000\\u{0000}\\u{00000}\\\\[xyz][a-c][^xyz][^a-c]x|y^$\\b\\B(x)\\1(?:x)x*x+x?x{5}x{5,}x{5,6}x*?x+?x??x{5}?x{5,}?x{5,6}?x(?=y)x(?!y)bar"));
    }

    #[test]
    fn and() {
        let parsed = super::Parsed::new("   foo   bar     ");

        assert!(parsed.pattern.len() == 2);
        assert!(parsed.matches("foo"));
        assert!(parsed.matches("bar"));
        assert!(parsed.matches("Foo"));
        assert!(parsed.matches("bAR"));
    }
}
