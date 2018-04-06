macro_rules! enum_boilerplate {
    ($type:tt, $($from:expr => $to:tt,)+) => {
        impl stdweb::unstable::TryFrom<stdweb::Value> for $type {
            type Error = stdweb::private::ConversionError;

            fn try_from(value: stdweb::Value) -> Result<Self, Self::Error> {
                match value {
                    stdweb::Value::String(string) => match string.as_str() {
                        $($from => Ok($type::$to),)+
                        // TODO better error message
                        _ => Err(stdweb::private::ConversionError::Custom("Unknown enum string".to_owned())),
                    },
                    // TODO use ConversionError::type_mismatch(&value)
                    _ => Err(stdweb::private::ConversionError::Custom("Wrong type".to_owned()))
                }
            }
        }

        impl $type {
            // TODO replace this with an implementation of JsSerialize or something ?
            #[allow(dead_code)]
            fn into_js_string(&self) -> &'static str {
                match *self {
                    $($type::$to => $from,)+
                }
            }
        }
    };
}
