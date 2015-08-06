import { each, indexed } from "../../../util/iterator";


export const update_tabs = (group) => {
  each(indexed(group.get("tabs")), ([i, tab]) => {
    tab.update("index", i);
  });
};
