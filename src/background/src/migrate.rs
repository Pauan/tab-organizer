use serde::Serialize;
use serde::de::DeserializeOwned;
use tab_organizer::{time, Database};
use wasm_bindgen::intern;


trait Key {
    type Id: DeserializeOwned + Serialize;

    fn key(id: &Self::Id) -> String;
}


trait Tabs {
    type TabId: DeserializeOwned;

    fn tabs(&self) -> Vec<Self::TabId>;
}


fn migrate_vec<Old, New>(old: Vec<Old>) -> Vec<New> where New: From<Old> {
    old.into_iter().map(|x| x.into()).collect()
}

fn migrate_db<OldWindow, NewWindow, OldTab, NewTab>(db: &Database)
    where OldWindow: DeserializeOwned + Key + Tabs<TabId = <OldTab as Key>::Id>,
          NewWindow: Serialize + Key + From<OldWindow>,
          <NewWindow as Key>::Id: From<<OldWindow as Key>::Id>,
          OldTab: DeserializeOwned + Key,
          NewTab: Serialize + Key + From<OldTab>,
          <NewTab as Key>::Id: From<<OldTab as Key>::Id> {

    if let Some(old_ids) = db.get::<Vec<<OldWindow as Key>::Id>>(intern("windows")) {
        let new_ids = old_ids.into_iter()
            .map(|old_id| {
                let old_key = <OldWindow as Key>::key(&old_id);
                let old_window = db.get::<OldWindow>(&old_key).unwrap();

                for old_id in old_window.tabs() {
                    let old_key = <OldTab as Key>::key(&old_id);
                    let old_tab = db.get::<OldTab>(&old_key).unwrap();

                    let new_tab: NewTab = old_tab.into();

                    let new_id: <NewTab as Key>::Id = old_id.into();
                    let new_key = <NewTab as Key>::key(&new_id);

                    db.remove(&old_key);
                    db.set::<NewTab>(&new_key, &new_tab);
                }

                let new_window: NewWindow = old_window.into();

                let new_id: <NewWindow as Key>::Id = old_id.into();
                let new_key = <NewWindow as Key>::key(&new_id);

                db.remove(&old_key);
                db.set::<NewWindow>(&new_key, &new_window);

                new_id
            })
            .collect();

        db.set::<Vec<<NewWindow as Key>::Id>>(intern("windows"), &new_ids);
    }
}


mod v1 {
    use serde::{Serialize, Deserialize};
    use uuid::Uuid;
    use super::v2;
    use super::v2::{SerializedWindow, Label};

    #[derive(Serialize, Deserialize)]
    pub struct Tag {
        pub name: String,
        pub timestamp_added: f64,
    }

    #[derive(Serialize, Deserialize)]
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

    impl super::Key for SerializedTab {
        type Id = Uuid;

        fn key(id: &Self::Id) -> String {
            format!("tab-ids.{}", id)
        }
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
                    Label {
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
        super::migrate_db::<SerializedWindow, SerializedWindow, SerializedTab, v2::SerializedTab>(db);
    }
}

mod v2 {
    use serde::{Serialize, Deserialize};
    use uuid::Uuid;
    use super::v3;
    pub(crate) use v3::{SerializedTab, Label};

    #[derive(Serialize, Deserialize)]
    pub struct SerializedWindow {
        pub uuid: Uuid,
        pub name: Option<String>,
        pub timestamp_created: f64,
        pub tabs: Vec<Uuid>,
    }

    impl super::Key for SerializedWindow {
        type Id = Uuid;

        fn key(id: &Self::Id) -> String {
            format!("window-ids.{}", id)
        }
    }

    impl super::Tabs for SerializedWindow {
        type TabId = Uuid;

        fn tabs(&self) -> Vec<Self::TabId> {
            self.tabs.clone()
        }
    }

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
        super::migrate_db::<SerializedWindow, v3::SerializedWindow, SerializedTab, SerializedTab>(db);
    }
}

mod v3 {
    use uuid::Uuid;
    use serde::{Serialize, Deserialize};
    use super::v4;
    pub(crate) use v4::{Label, WindowOptions, Timestamps, WindowId, TabId};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SerializedTab {
        pub uuid: Uuid,
        pub labels: Vec<Label>,
        pub timestamp_created: f64,
        pub timestamp_focused: Option<f64>,
        pub pinned: bool,
        pub favicon_url: Option<String>,
        pub url: Option<String>,
        pub title: Option<String>,
        pub muted: bool,
    }

    impl super::Key for SerializedTab {
        type Id = Uuid;

        fn key(id: &Self::Id) -> String {
            format!("tab-ids.{}", id)
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SerializedWindow {
        pub uuid: Uuid,
        pub name: Option<String>,
        pub timestamp_created: f64,
        pub tabs: Vec<Uuid>,
        pub options: WindowOptions,
    }

    impl super::Key for SerializedWindow {
        type Id = Uuid;

        fn key(id: &Self::Id) -> String {
            format!("window-ids.{}", id)
        }
    }

    impl super::Tabs for SerializedWindow {
        type TabId = Uuid;

        fn tabs(&self) -> Vec<Self::TabId> {
            self.tabs.clone()
        }
    }

    impl From<SerializedTab> for v4::SerializedTab {
        fn from(input: SerializedTab) -> Self {
            let SerializedTab {
                uuid,
                labels,
                timestamp_created,
                timestamp_focused,
                pinned,
                favicon_url,
                url,
                title,
                muted,
            } = input;

            Self {
                id: TabId::from_uuid(uuid),
                labels,
                timestamps: Timestamps {
                    created: timestamp_created,
                    updated: None,
                    focused: timestamp_focused,
                    unloaded: None,
                },
                pinned,
                favicon_url,
                url,
                title,
                muted,
            }
        }
    }

    impl From<SerializedWindow> for v4::SerializedWindow {
        fn from(input: SerializedWindow) -> Self {
            let SerializedWindow {
                uuid,
                name,
                timestamp_created,
                tabs,
                options,
            } = input;

            Self {
                id: WindowId::from_uuid(uuid),
                name,
                timestamp_created,
                tabs: super::migrate_vec(tabs),
                options,
            }
        }
    }

    pub(crate) fn migrate(db: &tab_organizer::Database) {
        super::migrate_db::<SerializedWindow, v4::SerializedWindow, SerializedTab, v4::SerializedTab>(db);
    }
}

mod v4 {
    pub(crate) use tab_organizer::state::{SerializedTab, SerializedWindow, Label, WindowOptions, Timestamps, WindowId, TabId};

    impl super::Key for SerializedTab {
        type Id = TabId;

        fn key(id: &Self::Id) -> String {
            SerializedTab::key(id)
        }
    }

    impl super::Key for SerializedWindow {
        type Id = WindowId;

        fn key(id: &Self::Id) -> String {
            SerializedWindow::key(id)
        }
    }

    impl super::Tabs for SerializedWindow {
        type TabId = TabId;

        fn tabs(&self) -> Vec<Self::TabId> {
            self.tabs.clone()
        }
    }
}


pub(crate) fn migrate(db: &Database) {
    const LATEST_VERSION: u32 = 4;

    let mut version = db.get_or_insert::<u32, _>(intern("version"), || LATEST_VERSION);

    if version != LATEST_VERSION {
        time!("Migrating", {
            while version < LATEST_VERSION {
                match version {
                    1 => v1::migrate(db),
                    2 => v2::migrate(db),
                    3 => v3::migrate(db),
                    _ => unreachable!(),
                }

                version += 1;
            }
        });

        db.set(intern("version"), &LATEST_VERSION);
    }
}
