import { each, indexed } from "../../../util/iterator";


// TODO this can be more efficient if it's given a starting index
export const update_groups = (groups) => {
  each(indexed(groups), ([i, group]) => {
    group.update("index", i);
  });
};

// TODO this can be more efficient if it's given a starting index
export const update_tabs = (group) => {
  each(indexed(group.get("tabs")), ([i, tab]) => {
    tab.update("index", i);
  });
};
