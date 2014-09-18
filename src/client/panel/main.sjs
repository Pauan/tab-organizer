require("../../hubs")

@ = require([
  { id: "./tab", name: "tab" },
  { id: "./group", name: "group" },

  { id: "sjs:sequence" },
  { id: "../animation", name: "animation" },
  { id: "lib:util/dom" }
])

var animateGroup = @Mechanism(function (elem) {
  while (true) {
    elem ..@animation.startAt(@group.hidden_style)
    elem ..@animation.endAt(@group.hidden_style)
  }
})

var animateTab = @Mechanism(function (elem) {
  while (true) {
    elem ..@animation.startAt(@tab.hidden_style)
    elem ..@animation.endAt(@tab.hidden_style)
  }
})

var animateTabBack = @Mechanism(function (elem) {
  while (true) {
    elem ..@animation.endAt(@tab.hidden_style)
    elem ..@animation.startAt(@tab.hidden_style)
  }
})

function tab(url, title) {
  return @tab.create({ title: url, url: url, favicon: "chrome://favicon/#{url}" })
}

var tabs = [
  tab("http://www.google.com/"),
  tab("http://www.yahoo.com/"),
  tab("http://www.amazon.com/"),
  tab("http://www.about.com/"),
  tab("http://www.bartleby.com/"),
  tab("http://groups.google.com/"),
  tab("http://news.google.com/"),
  tab("http://www.cnn.com/"),
  tab("http://www.ebay.com/"),
  tab("http://www.download.com/"),
  tab("http://www.craigslist.org/"),
  tab("http://www.reference.com/"),
  tab("http://www.wikipedia.org/"),
  tab("http://www.beliefnet.com/"),
  tab("http://www.anywho.com/"),
  tab("http://www.weather.com/"),
  tab("http://www.search.com/"),
  tab("http://www.hotmail.com/"),
  tab("http://www.nih.gov/"),
  tab("http://www.cnet.com/"),
  tab("http://www.lrb.co.uk/"),
  tab("http://www.refdesk.com/"),
  tab("http://www.mayoclinic.com/"),
  tab("http://www.guidestar.org/"),
  tab("http://www.firstgov.gov/"),
  tab("http://www.bbc.com/"),
  tab("http://www.imdb.com/"),
  tab("http://www.expedia.com/"),
  tab("http://www.slate.com/"),
  tab("http://www.nutrition.gov/"),
  tab("http://www.altmedicine.com/"),
  tab("http://www.citysearch.com/"),
  tab("http://www.monster.com/"),
  tab("http://www.vote-smart.org/"),
  tab("http://www.sciam.com/"),
  tab("http://www.espn.com/"),
  tab("http://www.encarta.com/"),
  tab("http://www.findlaw.com/"),
  tab("http://www.nature.com/"),
  tab("http://www.usatoday.com/news/states/ns1.htm"),
  tab("http://www.allposters.com/"),
  tab("http://www.time.com/"),
  tab("http://www.mapquest.com/"),
  tab("http://www.abebooks.com/"),
  tab("http://www.allmusic.com/"),
  tab("http://www.medlineplus.gov/"),
  tab("http://www.dmoz.org/"),
  tab("http://www.loc.gov/"),
  tab("http://windowsmedia.msn.com/radiotuner/"),
  tab("http://www.ucomics.com/"),
  tab("http://www.infoplease.com/"),
  tab("http://www.alexa.com/"),
  tab("http://vlmp.museophile.com/"),
  tab("http://www.un.org/"),
  tab("http://www.sacred-texts.com/"),
  tab("http://www.artforum.com/"),
  tab("http://www.webmd.com/"),
  tab("http://www.vlib.org/"),
  tab("http://moneycentral.msn.com/"),
  tab("http://www.classmates.com/"),
  tab("http://europa.eu.int/"),
  tab("http://groups.yahoo.com/"),
  tab("http://www.nybooks.com/"),
  tab("http://www.jokes.com/"),
  tab("http://www.priceline.com/"),
  tab("http://www.rottentomatoes.com/"),
  tab("http://www.ipl.org/"),
  tab("http://www.acefitness.com/"),
  tab("http://www.quicken.com/"),
  tab("http://www.andante.com/"),
  tab("http://lpi.oregonstate.edu/infocenter/"),
  tab("http://www.pcmag.com/"),
  tab("http://www.timesonline.co.uk/"),
  tab("http://www.fedworld.gov/jobs/jobsearch.html"),
  tab("http://www.iht.com/"),
  tab("http://onlinebooks.library.upenn.edu/"),
  tab("http://www.pogo.com/"),
  tab("http://www.bizrate.com/"),
  tab("http://www.billboard.com/"),
  tab("http://world.altavista.com/"),
  tab("http://www.give.org/"),
  tab("http://mathworld.wolfram.com/"),
  tab("http://www.webring.org/"),
  tab("http://www.careerbuilder.com/"),
  tab("http://www.411.com/"),
  tab("http://www.epinions.com/"),
  tab("http://www.ucalgary.ca/~lipton/journals.html"),
  tab("http://www.aldaily.com/"),
  tab("http://www.nolopress.com/"),
  tab("http://www.classical.net/"),
  tab("http://www.blogger.com/"),
  tab("http://www.nytimes.com/"),
  tab("http://www.earthcam.com/"),
  tab("http://www.bbb.org/"),
  tab("http://www.intelihealth.com/"),
  tab("http://www.livejournal.com/"),
  tab("http://www.bbc.co.uk/religion/"),
  tab("http://www.artsjournal.com/"),
  tab("http://www.ticketmaster.com/"),
  tab("http://www.gutenberg.net/")
]

var top = [
  @group.create({
    name: "foo",
    tabs: tabs.slice(0, 5)
  }) ..animateGroup,

  @group.create({
    name: "bar",
    tabs: tabs.slice(5, 14) ..@indexed ..@map(function ([i, x]) {
      if (i % 2 === 0) {
        return x ..animateTabBack
      } else {
        return x ..animateTab
      }
    })
    /*[
      @tab.create({ title: "YUPYUPYUPYUPYUP", favicon: "foo" }),
      @tab.create({ title: "HIYA THERE YOU GUYS", favicon: "foo" }) ..animateTab,
      @tab.create({ title: "HUHUHUH YES VERY NICE", favicon: "foo" }) ..animateTab,
      @tab.create({ title: "NONONONONONONO", favicon: "foo" }) ..animateTabBack
    ]*/
  }),

  @group.create({
    name: "qux",
    tabs: tabs.slice(14, 19) ..@indexed ..@map(function ([i, x]) {
      if (i === 2) {
        return x ..animateTab
      } else if (i === 3) {
        return x ..animateTab
      } else if (i === 4) {
        return x ..animateTabBack
      } else {
        return x
      }
    })
  })
]


document.body ..@appendContent(top)
