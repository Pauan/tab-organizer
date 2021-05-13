use tab_organizer::{px, theme_color, colors};
use futures_signals::signal::SignalExt;
use dominator::{class, pseudo, HIGHEST_ZINDEX};
use lazy_static::lazy_static;


// "chrome://mozapps/skin/places/defaultFavicon.svg"
pub(crate) const DEFAULT_FAVICON: &'static str = "favicons/default.svg";

pub(crate) const LOADING_MESSAGE_THRESHOLD: u32 = 500;

pub(crate) const MOUSE_SCROLL_THRESHOLD: f64 = 30.0; // Number of pixels before it starts scrolling
pub(crate) const MOUSE_SCROLL_SPEED: f64 = 0.5; // Number of pixels to move per millisecond

pub(crate) const INSERT_ANIMATION_DURATION: f64 = 250.0;
pub(crate) const DRAG_ANIMATION_DURATION: f64 = 150.0;
pub(crate) const SELECTED_TABS_ANIMATION_DURATION: f64 = 225.0;

pub(crate) const TAB_DRAGGING_THRESHOLD: f64 = 7.0; // Pixels the mouse has to move before dragging begins
pub(crate) const TAB_DRAGGING_TOP: i32 = 11;
pub(crate) const DRAG_GAP_PX: f64 = 32.0; // TODO adjust this based on how many tabs are being dragged
pub(crate) const INSERT_LEFT_MARGIN: f64 = 12.0;

pub(crate) const TOOLBAR_HEIGHT: f64 = 22.0;
pub(crate) const TOOLBAR_BORDER_WIDTH: f64 = 1.0;
pub(crate) const TOOLBAR_MARGIN: f64 = 4.0;
pub(crate) const TOOLBAR_TOTAL_HEIGHT: f64 = TOOLBAR_BORDER_WIDTH + (TOOLBAR_MARGIN * 2.0) + TOOLBAR_HEIGHT;

pub(crate) const GROUP_BORDER_WIDTH: f64 = 1.0;
pub(crate) const GROUP_PADDING_TOP: f64 = 3.0;
pub(crate) const GROUP_HEADER_HEIGHT: f64 = 18.0;
pub(crate) const GROUP_PADDING_BOTTOM: f64 = 3.0;

pub(crate) const TAB_BORDER_WIDTH: f64 = 1.0;
pub(crate) const TAB_BORDER_CROWN_WIDTH: f64 = 3.0;
pub(crate) const TAB_PADDING: f64 = 1.0;
pub(crate) const TAB_HEIGHT: f64 = 22.0;
pub(crate) const TAB_TOTAL_HEIGHT: f64 = (TAB_BORDER_WIDTH * 2.0) + (TAB_PADDING * 2.0) + TAB_HEIGHT;

pub(crate) const TAB_FAVICON_SIZE: f64 = 16.0;
pub(crate) const TAB_FAVICON_LEFT_MARGIN: f64 = 3.0;
pub(crate) const TAB_FAVICON_RIGHT_MARGIN: f64 = 2.0;

pub(crate) const TAB_CLOSE_BORDER_WIDTH: f64 = 1.0;


lazy_static! {
    pub(crate) static ref REPEATING_GRADIENT: &'static str = "repeating-linear-gradient(-45deg, \
                                                                  transparent             0px, \
                                                                  transparent             4px, \
                                                                  hsla(0, 0%, 100%, 0.05) 6px, \
                                                                  hsla(0, 0%, 100%, 0.05) 10px)";

    pub(crate) static ref MENU_ITEM_HOVER_STYLE: String = class! {
        // TODO a bit hacky
        .style("transition-duration", "0ms")
        .style("color", "hsla(211, 100%, 99%, 0.95)")
        .style("background-color", "hsl(211, 100%, 65%)")
        .style("border-color", "hsl(211, 38%, 62%) \
                                hsl(211, 38%, 57%) \
                                hsl(211, 38%, 52%) \
                                hsl(211, 38%, 57%)")
        .style("text-shadow", "1px 0px 1px hsla(0, 0%, 0%, 0.2), \
                               0px 0px 1px hsla(0, 0%, 0%, 0.1), \
                               0px 1px 1px hsla(0, 0%, 0%, 0.2)")
        .style("background-image", format!("linear-gradient(to bottom, \
                                                hsla(0, 0%, 100%, 0.2) 0%, \
                                                transparent            49%, \
                                                hsla(0, 0%,   0%, 0.1) 50%, \
                                                hsla(0, 0%, 100%, 0.1) 80%, \
                                                hsla(0, 0%, 100%, 0.2) 100%), {}",
                                           *REPEATING_GRADIENT))
        .style("z-index", "1")
    };

    pub(crate) static ref HEADER_STYLE: String = class! {
        .style("z-index", "3")
        .style("border-bottom-width", px(TOOLBAR_BORDER_WIDTH))
        .style("padding-top", px(TOOLBAR_MARGIN))
        .style("padding-left", px(TOOLBAR_MARGIN))
        .style("padding-bottom", px(TOOLBAR_MARGIN))
        .style("margin-right", px(TOOLBAR_MARGIN))

        .style_signal("border-color", theme_color(colors::toolbar_separator))
        .style_signal("background-color", theme_color(colors::tab_focused_background))
    };

    pub(crate) static ref TOOLBAR_STYLE: String = class! {
        .style("height", px(TOOLBAR_HEIGHT))
        //.style("margin-top", px(TOOLBAR_MARGIN))
        //.style("margin-left", "2px")
        //.style("border-radius", "2px")
        /*.style("border-color", "hsl(0, 0%, 50%) \
                                hsl(0, 0%, 40%) \
                                hsl(0, 0%, 40%) \
                                hsl(0, 0%, 50%)")*/
        //.style("box-shadow", "0px 1px 3px 0px hsl(211, 95%, 45%)")
    };

    pub(crate) static ref TOOLBAR_MENU_WRAPPER_STYLE: String = class! {
        .style("height", "100%")
    };

    pub(crate) static ref TOOLBAR_MENU_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("height", "100%")
        .style("padding-top", "2px")
        .style("padding-left", "6px")
        .style("padding-right", "6px")
        .style("margin-left", "3px")
        .style("border-radius", "3px")
        //.style("box-shadow", "inset 0px 0px 1px 0px hsl(211, 95%, 70%)")
    };

    pub(crate) static ref TOOLBAR_MENU_HOVER_STYLE: String = class! {
        .style_signal("background-color", theme_color(colors::icon_background))
    };

    pub(crate) static ref TOOLBAR_MENU_OPEN_STYLE: String = class! {
        .style_signal("background-color", theme_color(colors::icon_focused_background))
    };

    pub(crate) static ref HAMBURGER_STYLE: String = class! {
        .style("width", "12px")
        .style("height", "2px")
        .style("margin-top", "3px")

        .style_signal("background-color", theme_color(colors::icon))
    };

    pub(crate) static ref SEARCH_STYLE: String = class! {
        .style(["-moz-user-select", "user-select"], "auto")

        .style("box-sizing", "border-box")
        .style("height", "22px")
        .style("padding-top", "2px")
        .style("padding-bottom", "2px")
        .style("padding-left", "5px")
        .style("padding-right", "5px")
        //.style("height", "100%")
        //.style("box-shadow", "0px 1px 3px 0px hsl(211, 95%, 45%), inset 0px 0px 1px 0px hsl(211, 95%, 70%)")
        .style("border-radius", "3px")
        .style("border", "1px solid")

        .style_signal("color", theme_color(colors::search_text))
        .style_signal("background-color", theme_color(colors::search_background))
        .style_signal("border-color", theme_color(colors::search_border))

        .pseudo!(":active", {
            .style_signal("color", theme_color(colors::search_focused_text))
            .style_signal("background-color", theme_color(colors::search_focused_background))
            .style_signal("border-color", theme_color(colors::search_focused_border))
        })

        .pseudo!("::selection", {
            .style_signal("color", theme_color(colors::search_highlight_text))
            .style_signal("background-color", theme_color(colors::search_highlight_background))
        })
    };

    pub(crate) static ref GROUP_LIST_STYLE: String = class! {
        .style("overflow", "auto")
        // This moves the scrollbar to the left side
        .style("direction", "rtl")
        .style("box-shadow", "inset 0px 1px 5px 0px hsla(0, 0%, 0%, 0.1)")
    };

    pub(crate) static ref GROUP_LIST_CHILDREN_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("overflow", "hidden")
        .style("top", "1px")
        // This resets the direction so it works properly
        .style("direction", "ltr")
        .style("margin-right", "4px")
        .style("min-height", "calc(100% - 1px)")

        .style_signal("background-image", theme_color(colors::toolbar_separator).map(|color| {
            format!("
                linear-gradient(to right, rgba(0, 0, 0, 0.03), transparent 5%, transparent 75%, rgba(0, 0, 0, 0.03)),
                linear-gradient(to right, {} 0px, transparent 2px)
            ", color)
        }))
    };

    pub(crate) static ref GROUP_LIST_RIGHT_BORDER: String = class! {
        .style("position", "fixed")
        .style("top", "0px")
        .style("right", "1px")
        .style("width", "2px")
        .style("height", "100%")
        .style("border-left", "1px solid") // rgb(202, 202, 202) rgb(104, 150, 185)
        .style("border-right", "1px solid") // #e3e3e3

        .style_signal("border-left-color", theme_color(colors::tab_line))
        .style_signal("border-right-color", theme_color(colors::page_separator))
        .style_signal("background-color", theme_color(colors::tab_focused_background))
    };

    pub(crate) static ref GROUP_STYLE: String = class! {
        .style("padding-top", px(GROUP_PADDING_TOP))
        .style("border-top-width", px(GROUP_BORDER_WIDTH))
        .style("top", "-1px")

        .style_signal("border-color", theme_color(colors::tab_line))

        //.style("background-color", "hsl(0, 0%, 100%)")
    };

    pub(crate) static ref GROUP_PINNED_STYLE: String = class! {
        .style("white-space", "normal")
        .style("margin-top", px(TOOLBAR_MARGIN))
    };

    pub(crate) static ref GROUP_HEADER_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("height", px(GROUP_HEADER_HEIGHT))
        .style("padding-left", "12px")
        .style("padding-bottom", "2px")
        .style("font-size", "11px")
    };

    pub(crate) static ref GROUP_HEADER_TEXT_STYLE: String = class! {
        .style("overflow", "hidden")
    };

    pub(crate) static ref GROUP_TABS_STYLE: String = class! {
        .style("padding-bottom", px(GROUP_PADDING_BOTTOM))
    };

    pub(crate) static ref ICON_STYLE: String = class! {
        .style("height", px(TAB_FAVICON_SIZE))
        .style("border-radius", "4px")
        .style("box-shadow", "0px 0px 15px hsla(0, 0%, 100%, 0.9)")
        .style("background-color", "hsla(0, 0%, 100%, 0.35)")
    };

    pub(crate) static ref MENU_ITEM_STYLE: String = class! {
        .style("border-width", px(TAB_BORDER_WIDTH))

        .style("transition", "background-color 100ms ease-in-out")
    };

    pub(crate) static ref MENU_ITEM_SHADOW_STYLE: String = class! {
        // rgba(23, 56, 81, 0.34)
        /*.style("box-shadow", "      1px 1px  1px hsla(0, 0%,   0%, 0.25), \
                              inset 0px 0px  3px hsla(0, 0%, 100%, 1   ), \
                              inset 0px 0px 10px hsla(0, 0%, 100%, 0.25)")*/

        .style("box-shadow", "1px 1px  1px hsla(0, 0%,   0%, 0.25)")
    };

    pub(crate) static ref MENU_ITEM_HOLD_STYLE: String = class! {
        .style("background-position", "0px 1px")
        .style("background-image", format!("linear-gradient(to bottom, \
                                                hsla(0, 0%, 100%, 0.2)   0%, \
                                                transparent              49%, \
                                                hsla(0, 0%,   0%, 0.075) 50%, \
                                                hsla(0, 0%, 100%, 0.1)   80%, \
                                                hsla(0, 0%, 100%, 0.2)   100%), {}",
                                           *REPEATING_GRADIENT))
        .style("box-shadow",      "1px 1px  1px hsla(0, 0%,   0%, 0.1), \
                             inset 0px 0px  3px hsla(0, 0%, 100%, 0.9), \
                             inset 0px 0px 10px hsla(0, 0%, 100%, 0.225)")
    };

    pub(crate) static ref TAB_STYLE: String = class! {
        .style("border-width", px(TAB_BORDER_WIDTH))
        .style("padding", px(TAB_PADDING))
        .style("padding-right", "2px")
        .style("height", px(TAB_HEIGHT))
        .style("overflow", "hidden")
        //.style("border-top-left-radius", "5px")
        //.style("border-bottom-left-radius", "5px")
        .style("border-left-width", "4px")
        .style("border-right-width", "0px")
        //.style("margin-bottom", "-1px")
        .style("font-size", "12px")
    };

    pub(crate) static ref TAB_PINNED_STYLE: String = class! {
        .style("width", px(TAB_HEIGHT))
        .style("padding", px(TAB_PADDING))
        .style("padding-top", "0px")
        .style("border-width", px(TAB_BORDER_WIDTH))
        .style("border-top-width", px(TAB_BORDER_CROWN_WIDTH))
        .style("border-radius", "6px")
    };

    pub(crate) static ref TAB_HOVER_STYLE: String = class! {
        .style("border-color", "transparent")
        //.style("font-weight", "bold")

        .style_signal("border-left-color", theme_color(colors::tab_line))
        .style_signal("background-color", theme_color(colors::tab_hovered_background))
    };

    pub(crate) static ref TAB_PINNED_HOVER_STYLE: String = class! {
        .style("border-color", "transparent")
        .style_signal("border-top-color", theme_color(colors::tab_line))
    };

    pub(crate) static ref TAB_HOLD_STYLE: String = class! {
        .style("padding-top", "2px")
        .style("padding-bottom", "0px")
    };

    pub(crate) static ref TAB_UNLOADED_STYLE: String = class! {
        //.style("color", "hsl(0, 0%, 10%)")
        .style("opacity", "0.80")
    };

    /*pub(crate) static ref TAB_UNLOADED_HOVER_STYLE: String = class! {
        //.style("background-color", "hsla(0, 0%, 0%, 0.4)")

        // TODO this is needed to override the border color from TAB_FOCUSED_STYLE
        /*.style_important("border-color", "hsl(0, 0%, 62%) \
                                          hsl(0, 0%, 57%) \
                                          hsl(0, 0%, 52%) \
                                          hsl(0, 0%, 57%)")*/

        .style("color", "black")

        //.style("color", "hsla(0, 0%, 99%, 0.95)") // TODO minor code duplication with `MENU_ITEM_HOVER_STYLE`
        .style("opacity", "1")
    };*/

    pub(crate) static ref TAB_FOCUSED_STYLE: String = class! {
        //.style("background-color", "hsl(30, 100%, 94%")
        // TODO this is needed to override the border color from MENU_ITEM_HOVER_STYLE
        /*.style_important("border-color", "hsl(30, 70%, 62%) \
                                          hsl(30, 70%, 57%) \
                                          hsl(30, 70%, 52%) \
                                          hsl(30, 70%, 57%)")*/
        .style("background-image", "linear-gradient(to right, rgba(0, 0, 0, 0.01) 61.8%, transparent)")
        //.style("background-image", "linear-gradient(to right, rgb(217, 237, 255), white)") // #bfe1ff rgb(254, 254, 255)
        //.style("border-image", "linear-gradient(to right, rgb(10, 132, 255), rgb(202, 202, 202)) 1") // rgb(104, 150, 185) rgb(132, 161, 189) rgb(158, 159, 160)
        .style("z-index", "1")

        .style_signal("color", theme_color(colors::tab_focused_text))
        .style_signal("background-color", theme_color(colors::tab_focused_background))
        .style_signal("border-top-color", theme_color(colors::tab_line))
        .style_signal("border-bottom-color", theme_color(colors::tab_line))
        .style_signal("border-left-color", theme_color(colors::tab_focused_line))
    };

    pub(crate) static ref TAB_PINNED_FOCUSED_STYLE: String = class! {
        .style_signal("border-top-color", theme_color(colors::tab_focused_line))
        .style_signal("border-left-color", theme_color(colors::tab_line))
        .style_signal("border-right-color", theme_color(colors::tab_line))
        .style_signal("border-bottom-color", theme_color(colors::tab_line))
    };

    pub(crate) static ref TAB_SELECTED_STYLE: String = class! {
        .style("background-image", "linear-gradient(to right, hsl(100, 78%, 80%) 61.8%, white)")
        .style("border-image", "linear-gradient(to right, hsl(100, 50%, 50%) 61.8%, rgb(202, 202, 202)) 1")
        // TODO this is needed to override the border color from TAB_FOCUSED_STYLE
        /*.style_important("border-color", "hsl(100, 50%, 55%) \
                                          hsl(100, 50%, 50%) \
                                          hsl(100, 50%, 45%) \
                                          hsl(100, 50%, 50%)")*/
    };

    pub(crate) static ref TAB_PINNED_SELECTED_STYLE: String = class! {
        .style("background-image", "linear-gradient(to bottom, hsl(100, 78%, 80%) 61.8%, white)")
        .style("border-image", "linear-gradient(to bottom, hsl(100, 50%, 50%) 61.8%, rgb(202, 202, 202)) 1")
    };

    pub(crate) static ref TAB_SELECTED_HOVER_STYLE: String = class! {
        .style("background-image", "linear-gradient(to right, hsl(100, 80%, 65%) 61.8%, white)")
    };

    pub(crate) static ref TAB_PINNED_SELECTED_HOVER_STYLE: String = class! {
        .style("background-image", "linear-gradient(to bottom, hsl(100, 80%, 65%) 61.8%, white)")
    };

    pub(crate) static ref TAB_ATTENTION_STYLE: String = class! {
        .style("width", "12px")
        .style("height", "12px")
        .style("position", "absolute")
        .style("left", "6px")
        .style("bottom", "-1px")
    };

    pub(crate) static ref TAB_AUDIO_STYLE: String = class! {
        .style("width", "16px")
        .style("height", "16px")
        .style("opacity", "0.72")
    };

    pub(crate) static ref TAB_AUDIO_PINNED_STYLE: String = class! {
        .style("position", "absolute")
        .style("margin-top", "-9px")
        .style("margin-left", "8px")
        .style("z-index", "1")
        .style("opacity", "1")
    };

    pub(crate) static ref TAB_AUDIO_HOVER_STYLE: String = class! {
        .style("background-color", "white")
        .style("border-radius", "100%")
        .style("opacity", "1")
    };

    pub(crate) static ref TAB_FAVICON_STYLE: String = class! {
        .style("width", px(TAB_FAVICON_SIZE))
        .style("height", px(TAB_FAVICON_SIZE))
        .style("margin-left", px(TAB_FAVICON_LEFT_MARGIN))
        .style("margin-right", px(TAB_FAVICON_RIGHT_MARGIN))
    };

    pub(crate) static ref TAB_FAVICON_STYLE_UNLOADED: String = class! {
        //.style("filter", "grayscale(100%)")
    };

    pub(crate) static ref TAB_TEXT_STYLE: String = class! {
        .style("overflow", "hidden")
        .style("padding-left", "3px")
        .style("padding-right", "2px")
    };

    pub(crate) static ref TAB_CLOSE_STYLE: String = class! {
        .style("display", "flex")
        .style("justify-content", "center")
        .style("align-items", "center")
        .style("box-sizing", "border-box")
        .style("border-radius", "4px")
        .style("width", "20px")
        .style("height", "20px")
        .style("border-width", px(TAB_CLOSE_BORDER_WIDTH))
        .style("padding-left", "1px")
        .style("padding-right", "1px")
        .style("margin-right", "1px")
    };

    pub(crate) static ref TAB_CLOSE_ICON_STYLE: String = class! {
        .style("width", "14px")
        .style("height", "14px")
    };

    pub(crate) static ref TAB_CLOSE_HOVER_STYLE: String = class! {
        //.style("background-color", "rgb(227, 228, 230)")
        .style("background-color", "hsla(0, 0%, 100%, 0.75)")
        .style("border-color", "hsla(0, 0%, 90%, 0.75) \
                                hsla(0, 0%, 85%, 0.75) \
                                hsla(0, 0%, 85%, 0.75) \
                                hsla(0, 0%, 90%, 0.75)")
    };

    pub(crate) static ref TAB_CLOSE_HOLD_STYLE: String = class! {
        .style("padding-top", "1px")
        .style("background-color", "hsla(0, 0%, 98%, 0.75)")
        //.style("background-color", "rgb(204, 205, 207)")
        .style("border-color", "hsla(0, 0%,  70%, 0.75) \
                                hsla(0, 0%, 100%, 0.75) \
                                hsla(0, 0%, 100%, 0.80) \
                                hsla(0, 0%,  80%, 0.75)")
    };

    pub(crate) static ref DRAGGING_STYLE: String = class! {
        .style("position", "fixed")
        .style("z-index", "1")

        .style("height", "100%")
        .style("left", "0px")
        .style("top", "0px")
        .style("pointer-events", "none")
        .style("opacity", "0.98")

        // This resets the direction so it works properly
        .style("direction", "ltr")
        .style("overflow", "hidden")
    };

    pub(crate) static ref URL_BAR_STYLE: String = class! {
        .style("position", "fixed")
        .style("z-index", HIGHEST_ZINDEX)

        .style("box-sizing", "border-box")

        .style("pointer-events", "none")
        .style("left", "0px")
        .style("bottom", "0px")

        .style("max-width", "100%") // calc(100% + 1px)

        .style("border-top-width", "1px")
        .style("border-right-width", "1px")
        .style("border-top-color", "hsl(0, 0%, 45%)")
        .style("border-right-color", "hsl(0, 0%, 40%)")
        .style("border-top-right-radius", "5px")

        .style("padding-right", "2px") // 2px + 3px = 5px
        .style("padding-bottom", "1px")

        .style("color", "black")

        .style("background-color", "white")

        .style("box-shadow", "0px 0px 3px dimgray")
    };

    pub(crate) static ref URL_BAR_TEXT_STYLE: String = class! {
        .style("margin-left", "3px")
        .style("margin-right", "3px")
    };

    pub(crate) static ref URL_BAR_PROTOCOL_STYLE: String = class! {
        //.style("font-weight", "bold")
        .style("color", "hsl(120, 100%, 25%)")
    };

    pub(crate) static ref URL_BAR_DOMAIN_STYLE: String = class! {
        //.style("font-weight", "bold")
    };

    // TODO remove this ?
    pub(crate) static ref URL_BAR_PATH_STYLE: String = class! {};

    pub(crate) static ref URL_BAR_FILE_STYLE: String = class! {
        //.style("font-weight", "bold")
        .style("color", "darkred") // TODO replace with hsl
    };

    pub(crate) static ref URL_BAR_QUERY_STYLE: String = class! {
        //.style("font-weight", "bold")
        .style("color", "darkred") // TODO replace with hsl
    };

    pub(crate) static ref URL_BAR_HASH_STYLE: String = class! {
        .style("color", "darkblue") // TODO replace with hsl
    };

    pub(crate) static ref TAB_MENU_STYLE: String = class! {
        .style("position", "fixed")
    };
}
