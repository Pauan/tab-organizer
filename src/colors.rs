use crate::ColorScheme;
use web_extension::ThemeColors;


pub fn tab_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.frame())
        .unwrap_or_else(|| "#e3e4e6".to_string())
}

pub fn tab_hovered_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors|
        colors.tab_selected()
            .or_else(|| colors.toolbar())
            .or_else(|| colors.frame()))
        .unwrap_or_else(|| "#cccdcf".to_string())
}

pub fn tab_focused_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors|
        colors.tab_selected()
            .or_else(|| colors.toolbar())
            .or_else(|| colors.frame()))
        .unwrap_or_else(|| "#f5f6f7".to_string())
}


pub fn tab_line(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.tab_background_separator())
        .unwrap_or_else(|| "#a6a7a9".to_string())
}

pub fn tab_focused_line(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.tab_line())
        .unwrap_or_else(|| "#0a84ff".to_string())
}


pub fn tab_text(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.tab_background_text())
        .unwrap_or_else(|| "black".to_string())
}

pub fn tab_focused_text(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors|
        colors.tab_text()
            .or_else(|| colors.toolbar_text())
            .or_else(|| colors.tab_background_text()))
        .unwrap_or_else(|| "black".to_string())
}


pub fn icon(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors|
        colors.icons()
            .or_else(|| colors.toolbar_text()))
        .unwrap_or_else(|| "#5a5b5c".to_string())
}

pub fn icon_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.button_background_hover())
        .unwrap_or_else(|| "#dddedf".to_string())
}

pub fn icon_focused_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.button_background_active())
        .unwrap_or_else(|| "#d2d3d4".to_string())
}


pub fn page_separator(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_bottom_separator())
        .unwrap_or_else(|| "#cccccc".to_string())
}

pub fn toolbar_separator(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_top_separator())
        // rgb(0, 120, 215)
        .unwrap_or_else(|| "#9e9fa1".to_string())
}


pub fn search_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_field())
        .unwrap_or_else(|| "white".to_string())
}

pub fn search_focused_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors|
        colors.toolbar_field_focus()
            .or_else(|| colors.toolbar_field()))
        .unwrap_or_else(|| "white".to_string())
}


pub fn search_border(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_field_border())
        .unwrap_or_else(|| "#cccccc".to_string())
}

pub fn search_focused_border(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_field_border_focus())
        .unwrap_or_else(|| "#0078d7".to_string())
}


pub fn search_text(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_field_text())
        .unwrap_or_else(|| "black".to_string())
}

pub fn search_focused_text(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors|
        colors.toolbar_field_text_focus()
            .or_else(|| colors.toolbar_field_text()))
        .unwrap_or_else(|| "black".to_string())
}


pub fn search_highlight_text(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_field_highlight_text())
        .unwrap_or_else(|| "white".to_string())
}

pub fn search_highlight_background(colors: Option<ThemeColors>, scheme: ColorScheme) -> String {
    colors.and_then(|colors| colors.toolbar_field_highlight())
        .unwrap_or_else(|| "#0078d7".to_string())
}
