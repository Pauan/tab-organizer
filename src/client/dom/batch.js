const readers = [];
const writers = [];
let batching = false;

const batch = () => {
  if (!batching) {
    requestAnimationFrame(() => {
      while (readers["length"]) {
        readers["shift"]()();
      }

      let pending = writers["length"];

      // Run all the writers for this frame
      // If a writer adds another writer, it will be run on the next frame, not this frame
      do {
        writers["shift"]()();
        --pending;
      } while (pending !== 0);

      /*console["debug"]("dom.batch: " +
                       i_readers +
                       " readers, " +
                       i_writers +
                       " writers");*/

      batching = false;

      // More stuff is scheduled, run them on the next frame
      if (readers["length"] || writers["length"]) {
        batch();
      }
    });

    batching = true;
  }
};

/*export const batch_read = (f) => {
  readers["push"](f);
  batch();
};*/

export const batch_write = (f) => {
  f();
  /*writers["push"](f);
  batch();*/
};
