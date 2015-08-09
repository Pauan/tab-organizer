import { difference, round_to_hour, current_time } from "../../../util/time";
import { plural } from "../../../util/string";


// TODO move this to another module
// TODO test this
const diff_to_text = ({ year, week, day, hour }) => {
  if (year === 0 && week === 0 && day === 0 && hour === 0) {
    return "Less than an hour ago";

  } else {
    const out = [];

    if (year > 0) {
      out["push"](plural(year, " year"));
    }

    if (week > 0) {
      out["push"](plural(week, " week"));
    }

    if (day > 0) {
      out["push"](plural(day, " day"));
    }

    if (hour > 0) {
      out["push"](plural(hour, " hour"));
    }

    return out["join"](" ") + " ago";
  }
};

// TODO move this to another module
export const get_group_name = (time) =>
  diff_to_text(difference(get_group_time(current_time()), time));

export const get_group_time = round_to_hour;
