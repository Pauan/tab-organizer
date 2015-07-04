import { init as init_chrome } from "../chrome/server";
import { each, foldl } from "../util/iterator";
import { List } from "../util/mutable/list";
import { Timer } from "../util/time";
import { async } from "../util/async";


const version = 1435820160244;

const migrators = new List();

const migrate_to = (version, f) => {
  migrators.push((old_version, o) => {
    if (old_version < version) {
      return f(o);
    } else {
      return o;
    }
  });
};

const get_version = (o) => {
  if (o.has("version")) {
    const version = o.get("version");

    if (typeof version === "number") {
      return version;
    } else {
      return -1;
    }

  } else {
    return -1;
  }
};

export const migrate = (old_db) => {
  const old_version = get_version(old_db);

  if (old_version < version) {
    const new_db = foldl(old_db, migrators, (old_db, f) =>
                     f(old_version, old_db));

    if (new_db.has("version")) {
      return new_db.set("version", version);
    } else {
      return new_db.add("version", version);
    }

  } else if (old_version > version) {
    throw new Error("Cannot downgrade from version " +
                    old_version +
                    " to version " +
                    version);

  } else {
    return old_db;
  }
};


migrate_to(1414145108930, (o) => {
  delete localStorage["migrated"];
  return o;
});


migrate_to(1435820160244, (o) => {
  return o;
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
    yield db.set_all(new_db);

    console["debug"]("migrate: upgraded to version " +
                     version +
                     " (" +
                     timer.diff() +
                     "ms)");
  }

  return db;
});
