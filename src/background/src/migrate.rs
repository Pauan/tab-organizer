use serde::Serialize;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use tab_organizer::Database;
use tab_organizer::state::{SerializedTab, SerializedWindow};
use wasm_bindgen::intern;


const LATEST_VERSION: u32 = 2;


fn each_tab<F>(db: &Database, mut f: F) where F: FnMut(&Database, String) {
    if let Some(window_ids) = db.get::<Vec<Uuid>>(intern("windows")) {
        for window_id in window_ids {
            let window = db.get::<SerializedWindow>(&SerializedWindow::key(window_id)).unwrap();

            for tab_id in window.tabs {
                let key = SerializedTab::key(tab_id);
                f(db, key);
            }
        }
    }
}

fn migrate_tabs<Old, New>(db: &Database)
    where Old: DeserializeOwned,
          New: Serialize + From<Old> {
    each_tab(db, move |db, key| {
        let tab = db.get::<Old>(&key).unwrap();
        db.set::<New>(&key, &tab.into());
    });
}


mod v1 {
    use serde_derive::Deserialize;
    use uuid::Uuid;
    use tab_organizer::state;

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

    impl From<SerializedTab> for state::SerializedTab {
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
                    state::Label {
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
}


pub(crate) fn migrate(db: &Database) {
    let version = db.get_or_insert::<u32, _>(intern("version"), || LATEST_VERSION);

    if version != LATEST_VERSION {
        if version == 1 {
            migrate_tabs::<v1::SerializedTab, SerializedTab>(db);
        }

        db.set(intern("version"), &LATEST_VERSION);
    }
}
