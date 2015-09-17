import * as record from "../util/record";
import * as list from "../util/list";
import * as timer from "../util/timer";
import * as async from "../util/async";
import { init as init_chrome } from "../chrome/server";
import { fail } from "../util/assert";


const version = 1435820160244;

const migrators = list.make();

const migrate_to = (version, f) => {
  list.push(migrators, (old_version, db) => {
    if (old_version < version) {
      f(db);
    }
  });
};

const get_version = (db) => {
  if (record.has(db, "version")) {
    const version = record.get(db, "version");

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
    list.each(migrators, (f) => {
      f(old_version, db);
    });

    // TODO is this correct ?
    record.assign(db, "version", version);

    return true;

  } else if (old_version > version) {
    fail(new Error("Cannot downgrade from version " +
                   old_version +
                   " to version " +
                   version));

  } else {
    return false;
  }
};


migrate_to(1414145108930, (db) => {
  delete localStorage["migrated"];
});


migrate_to(1435820160244, (db) => {

});


export const init = async.all([init_chrome], ({ db }) => {
  // TODO hacky and inefficient
  const new_db = record.copy(db.get_all());

  const duration = timer.make();

  const migrated = migrate(new_db);

  timer.done(duration);

  if (migrated) {
    // TODO a bit hacky
    db.set_all(new_db);

    console["info"]("migrate: upgraded to version " +
                    version +
                    " (" +
                    timer.diff(duration) +
                    "ms)");

  } else {
    console["info"]("migrate: already at version " + version);
  }

  return async.done(db);
});
