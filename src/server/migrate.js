import { init as init_chrome } from "../chrome/server";
import { foldl } from "../util/iterator";
import { List } from "../util/immutable/list";
import { Timer } from "../util/time";
import { async } from "../util/async";


const version = 1435820160244;

let migrators = List();

const migrate_to = (version, f) => {
  migrators = migrators.push((old_version, db) => {
    if (old_version < version) {
      return f(db);
    } else {
      return db;
    }
  });
};

const get_version = (db) => {
  if (db.has("version")) {
    const version = db.get("version");

    if (typeof version === "number") {
      return version;
    } else {
      return -1;
    }

  } else {
    return -1;
  }
};

export const migrate = (db) => {
  const old_version = get_version(db);

  if (old_version < version) {
    const new_db = foldl(db, migrators, (db, f) => f(old_version, db));

    // TODO is this correct ?
    if (new_db.has("version")) {
      return new_db.update("version", version);
    } else {
      return new_db.insert("version", version);
    }

  } else if (old_version > version) {
    throw new Error("Cannot downgrade from version " +
                    old_version +
                    " to version " +
                    version);

  } else {
    return db;
  }
};


migrate_to(1414145108930, (db) => {
  delete localStorage["migrated"];
  return db;
});


migrate_to(1435820160244, (db) => {
  return db;
});


export const init = async(function* () {
  const { db } = yield init_chrome;

  const old_db = db.get_all();

  const timer = new Timer();

  const new_db = migrate(old_db);

  timer.done();

  if (old_db === new_db) {
    console["debug"]("migrate: already at version " + version);

  } else {
    db.set_all(new_db);

    console["debug"]("migrate: upgraded to version " +
                     version +
                     " (" +
                     timer.diff() +
                     "ms)");
  }

  return db;
});
