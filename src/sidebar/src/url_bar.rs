use wasm_bindgen::prelude::*;
use regex::{Regex, Match};
use tab_organizer::decode_uri_component;
use lazy_static::lazy_static;


lazy_static! {
    // http://en.wikipedia.org/wiki/URI_scheme#Generic_syntax
    // TODO test this
    static ref URL_REGEXP: Regex = Regex::new(
        r"^([a-zA-Z][a-zA-Z0-9\+\.\-]*:)?(?:(//)([^@]+@)?([^/\?#:]*)(:[0-9]+)?)?([^\?#]*?)([^/\?#]*)(\?[^#]*)?(#.*)?$"
    ).unwrap_throw();

    // http://en.wikipedia.org/wiki/List_of_Internet_top-level_domains
    // TODO test this
    static ref DOMAIN_REGEXP: Regex = Regex::new(
        r"(?i-u)(?:^www?\.)|(?:(?:\.[a-z][a-z])?\.[a-z]+$)"
    ).unwrap_throw();

    static ref SPACIFY_REGEXP: Regex = Regex::new(
        r"(?-u)[_\-\n\r]"
    ).unwrap_throw();

    static ref FILE_REGEXP: Regex = Regex::new(
        r"(?-u)\.(?:html?|php|asp)$"
    ).unwrap_throw();

    static ref QUERY_REMOVE_REGEXP: Regex = Regex::new(
        r"(?-u)^\??[\+&;]?"
    ).unwrap_throw();

    static ref QUERY_SEPARATOR_REGEXP: Regex = Regex::new(
        r"(?-u)[\+&;]"
    ).unwrap_throw();

    static ref QUERY_KEY_VALUE_REGEXP: Regex = Regex::new(
        r"(?-u)="
    ).unwrap_throw();
}


#[derive(Debug)]
pub(crate) struct UrlBar {
    pub(crate) protocol: Option<String>,
    pub(crate) separator: Option<String>,
    pub(crate) authority: Option<String>,
    pub(crate) domain: Option<String>,
    pub(crate) port: Option<String>,
    pub(crate) path: Option<String>,
    pub(crate) file: Option<String>,
    pub(crate) query: Option<String>,
    pub(crate) hash: Option<String>,
}

fn minify_domain(domain: String) -> String {
    // TODO remove the into_owned ?
    DOMAIN_REGEXP.replace_all(&domain, "").into_owned()
}

fn spacify(input: &str) -> String {
    // TODO remove the into_owned ?
    SPACIFY_REGEXP.replace_all(input, " ").into_owned()
}

impl UrlBar {
    pub(crate) fn new(url: &str) -> Option<Self> {
        let parsed = URL_REGEXP.captures(url);

        parsed.map(|parsed| {
            fn to_str<'a>(x: Match<'a>) -> String {
                x.as_str().to_owned()
            }

            // TODO is there a better way of doing this ?
            let protocol = parsed.get(1).map(to_str); // TODO lower case this ?
            let separator = parsed.get(2).map(to_str);
            let authority = parsed.get(3).map(to_str);
            let domain = parsed.get(4).map(to_str);
            let port = parsed.get(5).map(to_str);
            let path = parsed.get(6).map(to_str);
            let file = parsed.get(7).map(to_str);
            let query = parsed.get(8).map(to_str);
            let hash = parsed.get(9).map(to_str);

            Self { protocol, separator, authority, domain, port, path, file, query, hash }
        })
    }

    pub(crate) fn minify(self) -> Self {
        let should_protocol = match self.protocol.as_ref().map(|x| x.as_str()) {
            Some("https:") | Some("http:") | Some("") => false,
            _ => true,
        };

        let old_query = match self.query.as_ref().map(|x| x.as_str()) {
            Some("?") | Some("") => None,
            _ => self.query,
        };

        let mut path = None;
        let mut file = None;
        let mut query = None;

        if let Some(old_query) = old_query {
            query = Some({
                let query = QUERY_REMOVE_REGEXP.replace(&old_query, "");
                let query = QUERY_SEPARATOR_REGEXP.replace_all(&query, ", ");
                let query = QUERY_KEY_VALUE_REGEXP.replace_all(&query, ":");
                let query = spacify(&decode_uri_component(&query));
                query
            });

        } else if let Some(old_file) = self.file {
            file = Some(spacify(&decode_uri_component(&FILE_REGEXP.replace_all(&old_file, ""))));

        } else if let Some(old_path) = self.path {
            if old_path != "/" {
                path = Some(spacify(&decode_uri_component(&old_path)));
            }
        }

        let hash = match self.hash.as_ref().map(|x| x.as_str()) {
            Some("#") | Some("") => None,
            _ => self.hash.map(|hash| spacify(&decode_uri_component(&hash))),
        };

        Self {
            protocol: if should_protocol { self.protocol } else { None },
            separator: if should_protocol { self.separator } else { None },
            authority: self.authority,
            domain: self.domain.map(minify_domain),
            port: self.port,
            path,
            file,
            query,
            hash,
        }
    }
}
