use serde::Serialize;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use tab_organizer::Database;
use tab_organizer::state as latest;
use wasm_bindgen::intern;


fn each_window<F>(db: &Database, mut f: F) where F: FnMut(&Database, String) {
    if let Some(window_ids) = db.get::<Vec<Uuid>>(intern("windows")) {
        for window_id in window_ids {
            f(db, latest::SerializedWindow::key(window_id));
        }
    }
}

fn migrate_tabs<Window, Old, New, F>(db: &Database, mut f: F)
    where Window: DeserializeOwned,
          Old: DeserializeOwned,
          New: Serialize + From<Old>,
          F: FnMut(&Window) -> &[Uuid] {
    each_window(db, move |db, key| {
        let window = db.get::<Window>(&key).unwrap();

        for tab_id in f(&window) {
            let key = latest::SerializedTab::key(*tab_id);
            let tab = db.get::<Old>(&key).unwrap();
            db.set::<New>(&key, &tab.into());
        }
    });
}

fn migrate_windows<Old, New>(db: &Database)
    where Old: DeserializeOwned,
          New: Serialize + From<Old> {
    each_window(db, move |db, key| {
        let window = db.get::<Old>(&key).unwrap();
        db.set::<New>(&key, &window.into());
    });
}


mod v1 {
    use super::v2;
    use serde_derive::Deserialize;
    use uuid::Uuid;

    #[derive(Deserialize)]
    pub struct Tag {
        pub name: String,
        pub timestamp_added: f64,
    }

    #[derive(Deserialize)]
    pub struct SerializedTab {
        pub uuid: Uuid,
        pub tags: Vec<Tag>,
        pub timestamp_created: f64,
        pub timestamp_focused: Option<f64>,
        pub pinned: bool,
        pub favicon_url: Option<String>,
        pub url: Option<String>,
        pub title: Option<String>,
        pub muted: bool,
    }

    #[derive(Deserialize)]
    pub struct SerializedWindow {
        pub uuid: Uuid,
        pub name: Option<String>,
        pub timestamp_created: f64,
        pub tabs: Vec<Uuid>,
    }

    impl From<SerializedTab> for v2::SerializedTab {
        fn from(input: SerializedTab) -> Self {
            let SerializedTab {
                uuid,
                tags,
                timestamp_created,
                timestamp_focused,
                pinned,
                favicon_url,
                url,
                title,
                muted,
            } = input;

            Self {
                uuid,
                labels: tags.into_iter().map(|x| {
                    v2::Label {
                        name: x.name,
                        timestamp_added: x.timestamp_added,
                    }
                }).collect(),
                timestamp_created,
                timestamp_focused,
                pinned,
                favicon_url,
                url,
                title,
                muted,
            }
        }
    }

    pub(crate) fn migrate(db: &tab_organizer::Database) {
        super::migrate_tabs::<SerializedWindow, SerializedTab, v2::SerializedTab, _>(db, |window| &window.tabs);
    }
}

mod v2 {
    use super::v3;

    pub(crate) use v3::{SerializedTab, Label};
    pub(crate) use super::v1::SerializedWindow;

    impl From<SerializedWindow> for v3::SerializedWindow {
        fn from(input: SerializedWindow) -> Self {
            let SerializedWindow {
                uuid,
                name,
                timestamp_created,
                tabs,
            } = input;

            Self {
                uuid,
                name,
                timestamp_created,
                tabs,
                options: v3::WindowOptions::new(),
            }
        }
    }

    pub(crate) fn migrate(db: &tab_organizer::Database) {
        super::migrate_windows::<SerializedWindow, v3::SerializedWindow>(db);
    }
}

mod v3 {
    pub(crate) use tab_organizer::state::{SerializedTab, SerializedWindow, Label, WindowOptions};
}


pub(crate) fn migrate(db: &Database) {
    const LATEST_VERSION: u32 = 3;

    let mut version = db.get_or_insert::<u32, _>(intern("version"), || LATEST_VERSION);

    if version != LATEST_VERSION {
        while version < LATEST_VERSION {
            match version {
                1 => v1::migrate(db),
                2 => v2::migrate(db),
                _ => unreachable!(),
            }

            version += 1;
        }

        db.set(intern("version"), &LATEST_VERSION);
    }
}
