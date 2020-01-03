use tab_organizer::px;
use dominator::{class, HIGHEST_ZINDEX};
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

pub(crate) const TOOLBAR_HEIGHT: f64 = 30.0;
pub(crate) const TOOLBAR_BORDER_WIDTH: f64 = 1.0;
pub(crate) const TOOLBAR_MARGIN: f64 = 4.0;
pub(crate) const TOOLBAR_TOTAL_HEIGHT: f64 = TOOLBAR_BORDER_WIDTH + TOOLBAR_HEIGHT;

pub(crate) const GROUP_BORDER_WIDTH: f64 = 1.0;
pub(crate) const GROUP_PADDING_TOP: f64 = 3.0;
pub(crate) const GROUP_HEADER_HEIGHT: f64 = 18.0;
pub(crate) const GROUP_PADDING_BOTTOM: f64 = 3.0;

pub(crate) const TAB_BORDER_WIDTH: f64 = 1.0;
pub(crate) const TAB_BORDER_CROWN_WIDTH: f64 = 3.0;
pub(crate) const TAB_PADDING: f64 = 1.0;
pub(crate) const TAB_HEIGHT: f64 = 22.0;
pub(crate) const TAB_FAVICON_SIZE: f64 = 16.0;
pub(crate) const TAB_CLOSE_BORDER_WIDTH: f64 = 1.0;
pub(crate) const TAB_TOTAL_HEIGHT: f64 = (TAB_BORDER_WIDTH * 2.0) + (TAB_PADDING * 2.0) + TAB_HEIGHT;
pub(crate) const TAB_PINNED_WIDTH: f64 = (TAB_BORDER_WIDTH * 2.0) + (TAB_PADDING * 2.0) + TAB_HEIGHT;
pub(crate) const TAB_PINNED_HEIGHT: f64 = TAB_BORDER_CROWN_WIDTH + TAB_PADDING + TAB_HEIGHT + TAB_BORDER_WIDTH;


lazy_static! {
    pub(crate) static ref ROW_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "center") // TODO get rid of this ?
    };

    pub(crate) static ref COLUMN_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "stretch") // TODO get rid of this ?
    };

    pub(crate) static ref STRETCH_STYLE: String = class! {
        .style("flex-shrink", "1")
        .style("flex-grow", "1")
        .style("flex-basis", "0%")
    };

    pub(crate) static ref TOP_STYLE: String = class! {
        .style("white-space", "pre")
        .style("width", "100%")
        .style("height", "100%")
        .style("overflow", "hidden")
    };

    pub(crate) static ref MODAL_STYLE: String = class! {
        .style("position", "fixed")
        .style("left", "0px")
        .style("top", "0px")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "hsla(0, 0%, 0%, 0.15)")
    };

    pub(crate) static ref LOADING_STYLE: String = class! {
        .style("z-index", HIGHEST_ZINDEX)
        .style("color", "white")
        .style("font-weight", "bold")
        .style("font-size", "20px")
        .style("letter-spacing", "5px")
        .style("text-shadow", "1px 1px 1px black, 0px 0px 1px black")
    };

    pub(crate) static ref CENTER_STYLE: String = class! {
        .style("display", "flex")
        .style("flex-direction", "row")
        .style("align-items", "center")
        .style("justify-content", "center")
    };

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
        .style("background-color", "hsl(0, 0%, 100%)")
        .style("z-index", "3")
        .style("border-bottom-width", px(TOOLBAR_BORDER_WIDTH))
        .style("border-color", "rgb(202, 202, 202)") // rgb(0, 120, 215)
        .style("margin-right", px(TOOLBAR_MARGIN))
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

    pub(crate) static ref TOOLBAR_SEPARATOR_STYLE: String = class! {
        //.style("background-color", "hsl(211, 95%, 40%)")
        .style("border-color", "rgb(0, 120, 215)")
        .style("width", "1px")
        .style("height", "100%")
    };

    pub(crate) static ref TOOLBAR_MENU_WRAPPER_STYLE: String = class! {
        .style("height", "100%")
    };

    pub(crate) static ref TOOLBAR_MENU_STYLE: String = class! {
        .style("height", "100%")
        .style("padding-left", "11px")
        .style("padding-right", "11px")
        .style("box-shadow", "inset 0px 0px 1px 0px hsl(211, 95%, 70%)")
    };

    pub(crate) static ref TOOLBAR_MENU_HOLD_STYLE: String = class! {
        .style("top", "1px")
    };

    pub(crate) static ref SEARCH_STYLE: String = class! {
        .style("box-sizing", "border-box")
        .style("padding-top", "2px")
        .style("padding-bottom", "2px")
        .style("padding-left", "5px")
        .style("padding-right", "5px")
        .style("margin-left", "4px")
        //.style("height", "100%")
        //.style("box-shadow", "0px 1px 3px 0px hsl(211, 95%, 45%), inset 0px 0px 1px 0px hsl(211, 95%, 70%)")
        .style("border-radius", "3px")
        .style("border", "1px solid rgb(0, 120, 215)")
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
        .style("border-left", "1px solid rgb(202, 202, 202)")
        .style("min-height", "calc(100% - 1px)")
    };

    pub(crate) static ref GROUP_LIST_RIGHT_BORDER: String = class! {
        .style("position", "fixed")
        .style("top", "0px")
        .style("right", "0px")
        .style("width", "3px")
        .style("height", "100%")
        .style("border-left", "1px solid rgb(202, 202, 202)") // rgb(104, 150, 185)
        .style("border-right", "1px solid #e3e3e3")
        .style("background-color", "white") // rgb(217, 237, 255)
    };

    pub(crate) static ref GROUP_STYLE: String = class! {
        .style("padding-top", px(GROUP_PADDING_TOP))
        .style("border-top-width", px(GROUP_BORDER_WIDTH))
        .style("top", "-1px")
        .style("border-color", "hsl(211, 50%, 75%)")
        //.style("background-color", "hsl(0, 0%, 100%)")
    };

    pub(crate) static ref GROUP_PINNED_STYLE: String = class! {
        .style("white-space", "normal")
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
        .style("display", "inline-block")
        .style("padding", px(TAB_PADDING))
        .style("padding-bottom", "0px")
        .style("border-width", px(TAB_BORDER_WIDTH))
        .style("border-top-width", px(TAB_BORDER_CROWN_WIDTH))
        .style("border-radius", "6px")
    };

    pub(crate) static ref TAB_HOVER_STYLE: String = class! {
        .style("border-color", "transparent")
        .style("border-left-color", "rgb(163, 164, 166)")
        .style("background-color", "rgb(227, 228, 230)") // rgb(204, 205, 207)
        //.style("font-weight", "bold")
    };

    pub(crate) static ref TAB_PINNED_HOVER_STYLE: String = class! {
        .style("border-color", "transparent")
        .style("border-top-color", "rgb(163, 164, 166)")
    };

    pub(crate) static ref TAB_HOLD_STYLE: String = class! {
        .style("padding-top", "2px")
        .style("padding-bottom", "0px")
    };

    pub(crate) static ref TAB_UNLOADED_STYLE: String = class! {
        .style("color", "hsl(0, 0%, 30%)")
        .style("opacity", "0.75")
    };

    pub(crate) static ref TAB_UNLOADED_HOVER_STYLE: String = class! {
        .style("background-color", "hsla(0, 0%, 0%, 0.4)")

        // TODO this is needed to override the border color from TAB_FOCUSED_STYLE
        .style_important("border-color", "hsl(0, 0%, 62%) \
                                          hsl(0, 0%, 57%) \
                                          hsl(0, 0%, 52%) \
                                          hsl(0, 0%, 57%)")

        .style("color", "hsla(0, 0%, 99%, 0.95)") // TODO minor code duplication with `MENU_ITEM_HOVER_STYLE`
        .style("opacity", "1")
    };

    pub(crate) static ref TAB_FOCUSED_STYLE: String = class! {
        //.style("background-color", "hsl(30, 100%, 94%")
        // TODO this is needed to override the border color from MENU_ITEM_HOVER_STYLE
        /*.style_important("border-color", "hsl(30, 70%, 62%) \
                                          hsl(30, 70%, 57%) \
                                          hsl(30, 70%, 52%) \
                                          hsl(30, 70%, 57%)")*/
        .style("background-color", "white")
        //.style("background-image", "linear-gradient(to right, rgb(217, 237, 255), white)") // #bfe1ff rgb(254, 254, 255)
        //.style("border-image", "linear-gradient(to right, rgb(10, 132, 255), rgb(202, 202, 202)) 1") // rgb(104, 150, 185) rgb(132, 161, 189) rgb(158, 159, 160)
        .style("border-color", "rgb(202, 202, 202)")
        .style("border-left-color", "rgb(10, 132, 255)")
        .style("z-index", "1")
    };

    pub(crate) static ref TAB_PINNED_FOCUSED_STYLE: String = class! {
        .style("border-color", "rgb(202, 202, 202)")
        .style("border-top-color", "rgb(10, 132, 255)")
    };

    pub(crate) static ref TAB_FOCUSED_HOVER_STYLE: String = class! {
        .style("background-color", "white")
        .style("border-color", "rgb(202, 202, 202)")
        .style("border-left-color", "rgb(10, 132, 255)")
        //.style("background-color", "hsl(30, 85%, 57%)")
        //.style("background-image", "linear-gradient(to right, #b0daff 61.8%, white)")
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

    pub(crate) static ref TAB_FAVICON_STYLE: String = class! {
        .style("width", px(TAB_FAVICON_SIZE))
        .style("height", px(TAB_FAVICON_SIZE))
        .style("margin-left", "3px")
        .style("margin-right", "2px")
    };

    pub(crate) static ref TAB_FAVICON_STYLE_UNLOADED: String = class! {
        .style("filter", "grayscale(100%)")
    };

    pub(crate) static ref TAB_TEXT_STYLE: String = class! {
        .style("overflow", "hidden")
        .style("padding-left", "3px")
        .style("height", "100%")
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
        .style("margin-right", "2px")
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
        .style("z-index", HIGHEST_ZINDEX)

        .style("left", "0px")
        .style("top", "0px")
        .style("overflow", "visible")
        .style("pointer-events", "none")
        .style("opacity", "0.98")
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
}
