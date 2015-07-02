import { init as init_chrome } from "../chrome/server";
import { each } from "../util/iterator";
import { List } from "../util/list";
import { Timer } from "../util/time";
import { async } from "../util/async";


const version = 1435820160244;

const migrators = new List();

const migrate_to = (version, f) => {
  migrators.push((old_version, o) => {
    if (old_version < version) {
      f(o);
    }
  });
};

const get_version = (o) => {
  if ("version" in o) {
    if (typeof o["version"] === "number") {
      return o["version"];
    } else {
      return -1;
    }
  } else {
    return -1;
  }
};

export const migrate = (o) => {
  const old_version = get_version(o);

  if (old_version < version) {
    each(migrators, (f) => {
      f(old_version, o);
    });

    o["version"] = version;
    return true;

  } else if (old_version > version) {
    throw new Error("Cannot downgrade from version " +
                    old_version +
                    " to version " +
                    version);

  } else {
    return false;
  }
};


migrate_to(1414145108930, (o) => {
  delete localStorage["migrated"];
});


migrate_to(1435820160244, (o) => {

});


export const init = async(function* () {
  const { db } = yield init_chrome;

  const x = db.get_all();

  const timer = new Timer();

  const migrated = migrate(x);

  timer.done();

  if (migrated) {
    yield db.set_all(x);

    console["debug"]("migrate: upgraded to version " +
                     version +
                     " (" +
                     timer.diff() +
                     "ms)");

  } else {
    console["debug"]("migrate: already at version " + version);
  }

  return db;
});
