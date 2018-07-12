use tab_organizer::{RegExp, decode_uri_component};

lazy_static! {
    // http://en.wikipedia.org/wiki/URI_scheme#Generic_syntax
    // TODO test this
    static ref URL_REGEXP: RegExp = RegExp::new(
        "^([a-zA-Z][a-zA-Z0-9\\+\\.\\-]*:)(?:(\\/\\/)([^\\@]+\\@)?([^\\/\\?\\#\\:]*)(\\:[0-9]+)?)?([^\\?\\#]*?)([^\\/\\?\\#]*)(\\?[^\\#]*)?(\\#.*)?$",
        ""
    );

    // http://en.wikipedia.org/wiki/List_of_Internet_top-level_domains
    // TODO test this
    static ref DOMAIN_REGEXP: RegExp = RegExp::new(
        "(?:^www?\\.)|(?:(?:\\.[a-z][a-z])?\\.[a-z]+$)",
        "gi"
    );

    static ref SPACIFY_REGEXP: RegExp = RegExp::new(
        "[_\\-\\n\\r]",
        "g"
    );

    static ref FILE_REGEXP: RegExp = RegExp::new(
        "\\.(?:html?|php|asp)$",
        "g"
    );

    static ref QUERY_REMOVE_REGEXP: RegExp = RegExp::new(
        "^\\??[\\+&;]?",
        ""
    );

    static ref QUERY_SEPARATOR_REGEXP: RegExp = RegExp::new(
        "[\\+&;]",
        "g"
    );

    static ref QUERY_KEY_VALUE_REGEXP: RegExp = RegExp::new(
        "=",
        "g"
    );
}

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
    DOMAIN_REGEXP.replace(&domain, "")
}

fn spacify(input: &str) -> String {
    SPACIFY_REGEXP.replace(input, " ")
}

impl UrlBar {
    pub(crate) fn new(url: &str) -> Option<Self> {
        let parsed = URL_REGEXP.first_match(url);

        parsed.map(|mut parsed| {
            // TODO is there a better way of doing this ?
            let protocol = parsed.remove(1); // TODO lower case this ?
            let separator = parsed.remove(1);
            let authority = parsed.remove(1);
            let domain = parsed.remove(1);
            let port = parsed.remove(1);
            let path = parsed.remove(1);
            let file = parsed.remove(1);
            let query = parsed.remove(1);
            let hash = parsed.remove(1);

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
                let query = QUERY_SEPARATOR_REGEXP.replace(&query, ", ");
                let query = QUERY_KEY_VALUE_REGEXP.replace(&query, ":");
                let query = spacify(&decode_uri_component(&query));
                query
            });

        } else if let Some(old_file) = self.file {
            file = Some(spacify(&decode_uri_component(&FILE_REGEXP.replace(&old_file, ""))));

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
