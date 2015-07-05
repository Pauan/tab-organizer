import { init as init_chrome } from "../chrome/server";
import { each, foldl } from "../util/iterator";
import { List } from "../util/mutable/list";
import { Timer } from "../util/time";
import { async } from "../util/async";


const version = 1435820160244;

const migrators = new List();

const migrate_to = (version, f) => {
  migrators.push((old_version, db) => {
    if (old_version < version) {
      f(db);
    }
  });
};

const get_version = (db) => {
  if (db.has(["version"])) {
    const version = db.get(["version"]);

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
    const timer = new Timer();

    db.transaction((db) => {
      each(migrators, (f) => {
        f(old_version, db);
      });

      // TODO is this correct ?
      if (db.has(["version"])) {
        db.set(["version"], version);
      } else {
        db.add(["version"], version);
      }
    });

    timer.done();

    console["debug"]("migrate: upgraded to version " +
                     version +
                     " (" +
                     timer.diff() +
                     "ms)");

  } else if (old_version > version) {
    throw new Error("Cannot downgrade from version " +
                    old_version +
                    " to version " +
                    version);

  } else {
    console["debug"]("migrate: already at version " + version);
  }
};


migrate_to(1414145108930, (db) => {
  delete localStorage["migrated"];

});


migrate_to(1435820160244, (db) => {

});


export const init = async(function* () {
  const { db } = yield init_chrome;

  migrate(db);

  return db;
});
