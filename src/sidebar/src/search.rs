//use nom::types::CompleteStr;
use std::collections::HashMap;
use futures_signals::signal::{Mutable, MutableLockRef};
use std::sync::Arc;
use regex::{Regex, RegexBuilder, escape};
use crate::types::{State, Group, Tab};


/*named!(atom<CompleteStr, Parsed>,
    do_parse!(
        many0!(char!(' ')) >>
        // TODO better literal test
        literal: is_not!(" ") >>
        (Parsed::Literal(RegExp::new(&RegExp::escape(&literal), "i")))
    )
);

named!(parse<CompleteStr, Parsed>,
    do_parse!(
        init: atom >>
        res: fold_many0!(
            tuple!(
                many1!(char!(' ')),
                atom
            ),
            init,
            |acc, v: (_, _)| {
                Parsed::And(Box::new(acc), Box::new(v.1))
            }
        ) >>
        (res)
    )
);*/


fn matches_tab(parsed: &Parsed, url_count: &HashMap<String, usize>, tab: &Tab) -> bool {
    match parsed {
        Parsed::True => true,

        Parsed::Literal(regexp) => {
            let title = tab.title.lock_ref();
            let url = tab.url.lock_ref();

            // TODO make this more efficient ?
            let title = title.as_ref().map(|x| x.as_str()).unwrap_or("");
            let url = url.as_ref().map(|x| x.as_str()).unwrap_or("");

            regexp.is_match(title) || regexp.is_match(url)
        },

        Parsed::And(left, right) => matches_tab(left, url_count, tab) && matches_tab(right, url_count, tab),

        Parsed::IsLoaded => !tab.state.status.get().is_none(),

        Parsed::IsDuplicate => todo!(),

        Parsed::Tag(tag) => todo!(),

        Parsed::Error(error) => todo!(),
    }
}


#[derive(Debug)]
pub(crate) struct SearchLock<'a> {
    url_count: &'a HashMap<String, usize>,
    parser: MutableLockRef<'a, Arc<Parsed>>,
}

impl<'a> SearchLock<'a> {
    pub(crate) fn matches_tab(&self, tab: &Tab) -> bool {
        matches_tab(&self.parser, &self.url_count, tab)
    }
}


#[derive(Debug)]
pub(crate) struct Search {
    url_count: HashMap<String, usize>,
    pub(crate) value: Mutable<Arc<String>>,
    pub(crate) parser: Mutable<Arc<Parsed>>,
}

impl Search {
    pub(crate) fn new(search_value: String) -> Self {
        Self {
            url_count: HashMap::new(),

            parser: Mutable::new(Arc::new(Parsed::new(&search_value))),
            value: Mutable::new(Arc::new(search_value)),
        }
    }

    pub(crate) fn tab_created(&mut self, tab: &Tab) {
        let url = tab.url.lock_ref();

        if let Some(url) = url.as_deref() {
            let count = self.url_count.entry(url.clone()).or_insert(0);
            // TODO check for overflow ?
            *count += 1;
        }
    }

    pub(crate) fn tab_removed(&mut self, tab: &Tab) {
        let url = tab.url.lock_ref();

        if let Some(url) = url.as_deref() {
            let count = self.url_count.get_mut(&*url).unwrap();
            assert!(*count > 0);
            *count -= 1;
        }
    }

    pub(crate) fn lock_ref(&self) -> SearchLock<'_> {
        SearchLock {
            url_count: &self.url_count,
            parser: self.parser.lock_ref(),
        }
    }
}


impl Tab {
    pub(crate) fn set_matches_search(&self, matches: bool) {
        self.matches_search.set_neq(matches);
    }
}


#[derive(Debug)]
pub(crate) enum Parsed {
    True,
    Literal(Regex),
    And(Box<Parsed>, Box<Parsed>),
    IsLoaded,
    IsDuplicate,
    Tag(String),
    Error(&'static str),
}

impl Parsed {
    // TODO proper parser
    pub(crate) fn new(input: &str) -> Self {
        // TODO a bit hacky
        //parse(CompleteStr(input)).unwrap().1

        input.split(" ")
            .filter(|x| *x != "")
            .map(|x| {
                // TODO make this faster
                match x.splitn(2, ":").collect::<Vec<_>>().as_slice() {
                    [x] => {
                        Parsed::Literal(RegexBuilder::new(&escape(x))
                            .case_insensitive(true)
                            .unicode(false)
                            .build()
                            .unwrap())
                    },
                    [x, y] => {
                        match (*x, *y) {
                            ("is", "loaded") => Parsed::IsLoaded,
                            ("is", "duplicate") => Parsed::IsDuplicate,
                            ("tag", tag) => Parsed::Tag(tag.to_string()),
                            _ => Parsed::Error("unknown search term"),
                        }
                    },
                    _ => Parsed::Error("unknown search term"),
                }
            })
            .fold(Parsed::True, |old, new| {
                if let Parsed::True = old {
                    new

                } else {
                    Parsed::And(Box::new(old), Box::new(new))
                }
            })
    }
}


/*#[cfg(test)]
mod tests {
    #[test]
    fn parse() {
        let parsed = super::Parsed::new("foo.\\d\\D\\w\\W\\s\\S\\t\\r\\n\\v\\f[\\b]\\0\\cM\\x00\\u0000\\u{0000}\\u{00000}\\\\[xyz][a-c][^xyz][^a-c]x|y^$\\b\\B(x)\\1(?:x)x*x+x?x{5}x{5,}x{5,6}x*?x+?x??x{5}?x{5,}?x{5,6}?x(?=y)x(?!y)bar");

        //assert!(parsed.pattern.len() == 1);
        assert!(parsed.matches("foo.\\d\\D\\w\\W\\s\\S\\t\\r\\n\\v\\f[\\b]\\0\\cM\\x00\\u0000\\u{0000}\\u{00000}\\\\[xyz][a-c][^xyz][^a-c]x|y^$\\b\\B(x)\\1(?:x)x*x+x?x{5}x{5,}x{5,6}x*?x+?x??x{5}?x{5,}?x{5,6}?x(?=y)x(?!y)bar"));
    }

    #[test]
    fn and() {
        let parsed = super::Parsed::new("   foo   bar     ");

        //assert!(parsed.pattern.len() == 2);
        assert!(parsed.matches("foo"));
        assert!(parsed.matches("bar"));
        assert!(parsed.matches("Foo"));
        assert!(parsed.matches("bAR"));
    }
}*/
