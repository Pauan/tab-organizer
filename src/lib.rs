#[macro_export]
macro_rules! log {
    ($($args:tt)*) => {
        js! { @(no_return)
            console.log(@{format!($($args)*)});
        }
    };
}
