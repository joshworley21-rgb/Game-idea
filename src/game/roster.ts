/**
 * The hundred people this administration actually has to deal with: staff,
 * cabinet, the Hill, the money, the press, the world, and the country
 * itself. Every name the game shows — cabinet secretaries, the correspondent
 * who grills you at the podium, the allied prime minister on the secure
 * line — is drawn from here, so "Secretary of State" is always the same
 * particular person with the same stance and the same tell, not a random
 * label reshuffled each run.
 *
 * This is content, not simulation: nothing here is a numeric subsystem.
 * `agenda` and `quirks` are flavor the UI can surface next to a name;
 * `cutout` is the physical description of their standee — the specific
 * cardboard, wear and repair that makes each cutout read as a particular
 * object with a history, not a template. Where the game already has a
 * mechanical slot (a cabinet office, a fixed conversation speaker), the
 * matching roster person fills it — see `cabinet.ts` and `conversations.ts`.
 */

export type RosterCategory =
  | "Executive Staff"
  | "Cabinet"
  | "Legislator"
  | "Special Interest"
  | "Media"
  | "Civil Society"
  | "Foreign Leader"
  | "Multilateral Body"
  | "Western Ally"
  | "Regional Power"
  | "Middle Eastern Partner"
  | "Allied Trading Partner"
  | "Non-Aligned Bloc"
  | "Rival Superpower"
  | "Diplomatic Corps"
  | "Regional Ally"
  | "Frontline Ally"
  | "Strategic Partner"
  | "Citizen";

export interface RosterPerson {
  id: number;
  name: string;
  role: string;
  category: RosterCategory;
  agenda: string;
  quirks: string;
  cutout: string;
}

export const ROSTER: RosterPerson[] = [
  { id: 1, name: "Arthur Vance", role: "Chief of Staff", category: "Executive Staff", agenda: "Institutional stability; avoids scandals at all costs.", quirks: "Speaks in dry whispers; checks a pocket watch when annoyed.", cutout: "Heavy double-ply cardboard; visible fold crease at waist." },
  { id: 2, name: "Evelyn Reed", role: "Press Secretary", category: "Executive Staff", agenda: "Narrative control; pro-administration spin.", quirks: "Compulsively clicks pens; deflects tough questions with humor.", cutout: "Bright glossy stock; slight water ring stain on lower hem." },
  { id: 3, name: "Gen. Marcus Hall", role: "Sec. of Defense", category: "Cabinet", agenda: "Military modernization; hawkish deterrence.", quirks: "Terse, rigid posture; cracks knuckles during briefings.", cutout: "Matte olive cardstock; crisp, sharp die-cut silhouette." },
  { id: 4, name: "Nadia Al-Mansoor", role: "Sec. of State", category: "Cabinet", agenda: "Multilateral diplomacy; trade-route security.", quirks: "Never raises voice; meticulously folds documents into squares.", cutout: "Premium smooth board; clean white die-cut edges." },
  { id: 5, name: "Clara Lin", role: "Sec. of Treasury", category: "Cabinet", agenda: "Fiscal austerity; deficit reduction.", quirks: "Glances at inflation tickers mid-sentence; sighs frequently.", cutout: "Graph-paper texture printed on matte grey backing." },
  { id: 6, name: "Devon Cross", role: "National Security Advisor", category: "Executive Staff", agenda: "Covert interdiction; intelligence autonomy.", quirks: "Avoids digital screens; writes only on yellow legal pads.", cutout: "Dull charcoal finish; ragged, hand-torn top edge." },
  { id: 7, name: "Tariq Morales", role: "Attorney General", category: "Cabinet", agenda: "Rule of law; aggressive anti-monopoly prosecution.", quirks: "Rubs temple when stressed; cites legal precedents from memory.", cutout: "Heavy manila folder stock; reinforced brass-grommet base." },
  { id: 8, name: "Elena Rostova", role: "Sec. of Energy", category: "Cabinet", agenda: "Grid resilience; rapid transition to nuclear power.", quirks: "Drinks cold black coffee constantly; speaks in rapid bursts.", cutout: "Semi-gloss card with neon-yellow printer registration marks." },
  { id: 9, name: "Gideon Ward", role: "Senior Political Advisor", category: "Executive Staff", agenda: "Electoral math; populist campaign rallies.", quirks: "Chews unlit toothpicks; constantly checks poll margins.", cutout: "Dog-eared corners; scotch tape visible on back strut." },
  { id: 10, name: "Regina Phelps", role: "Sec. of Health", category: "Cabinet", agenda: "Universal preventative care; pandemic readiness.", quirks: "Wipes hands with sanitizer between handshakes; hyper-vigilant.", cutout: "Clean hospital-white board; faint scissor snips visible." },
  { id: 11, name: "Frank Kowalski", role: "Sec. of Labor", category: "Cabinet", agenda: "Domestic manufacturing tariffs; union expansion.", quirks: "Rolls sleeves to elbows; slams desk to emphasize points.", cutout: "Rough industrial corrugated board; exposed cardboard ridges." },
  { id: 12, name: "Amara Okafor", role: "Sec. of Interior", category: "Cabinet", agenda: "Public land conservation; water rights enforcement.", quirks: "Speaks slowly with weight; carries antique soil-testing vials.", cutout: "Recycled flecked paperboard; torn lower corner." },
  { id: 13, name: "Hugo Beltran", role: "Dir. of National Intelligence", category: "Executive Staff", agenda: "Counter-espionage; cyber-defense expansion.", quirks: "Blinks rarely; looks just past people's shoulders.", cutout: "Heavy dark Kraft paper; blacked-out redaction print marks." },
  { id: 14, name: "Dr. Sunita Patel", role: "Office of Science & Tech", category: "Executive Staff", agenda: "AI safety governance; STEM research funding.", quirks: "Adjusts round spectacles; draws diagrams on napkins.", cutout: "Thin SBS board; CMYK color-alignment strip on shoulder." },
  { id: 15, name: "Brooke Sterling", role: "White House Counsel", category: "Executive Staff", agenda: "Constitutional limits; leak prevention.", quirks: "Never agrees on the record; relies on hypotheticals.", cutout: "Ivory linen-textured cardboard; pristine square-cut edges." },
  { id: 16, name: "Hector Ramos", role: "Sec. of Transportation", category: "Cabinet", agenda: "High-speed rail corridors; port automation.", quirks: "Fidgets with miniature train models; hates motorcades.", cutout: "Yellowed transit-card stock; scuffed asphalt-grey print." },
  { id: 17, name: "Julian Mercer", role: "Dir. of Legislative Affairs", category: "Executive Staff", agenda: "Congressional horse-trading; coalition maintenance.", quirks: "Whispers deal terms; remembers every lawmaker's birthday.", cutout: "Flimsy poster board with clear scotch-tape hinge repair." },
  { id: 18, name: "Loretta Simmons", role: "Sec. of Housing", category: "Cabinet", agenda: "Affordable urban density; rent-stabilization grants.", quirks: "Points with index finger; recites neighborhood census data.", cutout: "Brick-patterned backing board; worn die-cut perimeter." },
  { id: 19, name: "Dale Cavanaugh", role: "Sec. of Agriculture", category: "Cabinet", agenda: "Farm subsidies; grain reserve management.", quirks: "Squints as if outdoors; wears weathered western boots indoors.", cutout: "Coarse Kraft cardboard; visible bent crease across legs." },
  { id: 20, name: "Miriam Vance", role: "Sec. of Education", category: "Cabinet", agenda: "Standardized testing reform; trade school pipelines.", quirks: "Uses dry-erase markers on office windows; sharp tone.", cutout: "Recycled loose-leaf board; faintly faded classroom-blue tint." },
  { id: 21, name: "Col. Trent Ross", role: "Chairman, Joint Chiefs", category: "Executive Staff", agenda: "Force readiness; strategic restraint in foreign conflicts.", quirks: "Hands clamped behind back; measures words before speaking.", cutout: "Thick chipboard; matte green-drab finish, sharp corners." },
  { id: 22, name: "Siddharth Roy", role: "Dir. of OMB", category: "Executive Staff", agenda: "Zero-baseline budgeting; slashing departmental waste.", quirks: "Taps mechanical pencil rhythmically; rarely smiles.", cutout: "Thin index card paper; visible vertical fold down center." },
  { id: 23, name: "Valerie Duke", role: "Chief Speechwriter", category: "Executive Staff", agenda: "Ideological unity; soaring rhetorical appeal.", quirks: "Mumbles sentences under breath while pacing; disheveled hair.", cutout: "Newsprint adhered to chipboard; light ink smudges on hands." },
  { id: 24, name: "Aaron Castillo", role: "White House Social Sec.", category: "Executive Staff", agenda: "Diplomatic protocol; optics and event pageantry.", quirks: "Flawless posture; scans room entrance while talking.", cutout: "Gloss-laminated sturdy cardstock; pristine edge trimming." },
  { id: 25, name: "Maya Lindholm", role: "Special Envoy for Climate", category: "Executive Staff", agenda: "Global emissions caps; carbon tariff enforcement.", quirks: "Sits on desk edges; checks air-quality indices constantly.", cutout: "100% unbleached post-consumer board; visible pulp flecks." },
  { id: 26, name: "Sen. Walter Brant", role: "Senate Majority Leader", category: "Legislator", agenda: "Institutional gridlock; party discipline.", quirks: "Clears throat loudly before speaking; leans on podiums.", cutout: "Thick, faded archival board; yellowed margins." },
  { id: 27, name: "Rep. Hannah Zhao", role: "Speaker of the House", category: "Legislator", agenda: "Progressive economic reform; coalition balancing.", quirks: "Checks watch mid-argument; taps gavel rhythmically.", cutout: "Modern crisp display card; slight bend along left side." },
  { id: 28, name: "Sen. Mitchell Burke", role: "Senate Minority Leader", category: "Legislator", agenda: "Executive obstruction; procedural filibusters.", quirks: "Glances sideways at TV cameras; smirks during debates.", cutout: "Heavy greyboard; dented right shoulder corner." },
  { id: 29, name: "Rep. Travis Carrow", role: "Hardline Caucus Chair", category: "Legislator", agenda: "Deficit slashing; hard border measures.", quirks: "Interrupts colleagues; wags index finger aggressively.", cutout: "Stiff craft board; raw exposed edges with white fuzz." },
  { id: 30, name: "Sen. Dianne Holloway", role: "Moderate Coalition Lead", category: "Legislator", agenda: "Bipartisan compromise; defense procurement.", quirks: "Sips ice water through straw; speaks in measured tones.", cutout: "Plain manila card; minor horizontal crease near knees." },
  { id: 31, name: "Rep. Jamal Keith", role: "House Progressive Whip", category: "Legislator", agenda: "Corporate wealth taxation; green jobs guarantee.", quirks: "Uses sharp, animated hand gestures; unbuttons collar.", cutout: "Smooth poster card; saturated colors, cleanly laser-cut." },
  { id: 32, name: "Sen. Thaddeus Holt", role: "Senior Rustbelt Senator", category: "Legislator", agenda: "Domestic steel protections; pension guarantees.", quirks: "Wears off-rack rumpled suits; gruff, booming voice.", cutout: "Dark coarse industrial cardboard; rough perimeter shearing." },
  { id: 33, name: "Rep. Chloe Vane", role: "Rising Star Firebrand", category: "Legislator", agenda: "Viral social media reach; establishment tearing.", quirks: "Glances at live phone stream counts; quick dismissive nods.", cutout: "Glossy magazine cutout pasted over chipboard core." },
  { id: 34, name: "Sen. Lyle Jenkins", role: "Intelligence Committee Chair", category: "Legislator", agenda: "Secret surveillance expansion; drone authorizations.", quirks: "Low voice requiring listeners to lean in; flat stare.", cutout: "Heavy matte black card; sharp, unblemished edges." },
  { id: 35, name: "Rep. Oscar Fuentes", role: "Border District Rep", category: "Legislator", agenda: "Port trade efficiency; guest-worker reform.", quirks: "Speaks bilingual idioms; carries thick printed binders.", cutout: "Sandy-tan Kraft paperboard; scuffed base footing." },
  { id: 36, name: "Sen. Patricia Boyd", role: "Judiciary Committee Lead", category: "Legislator", agenda: "Federal judicial appointments; strict textualism.", quirks: "Wears large wire-frame glasses; corrects others' grammar.", cutout: "Thick binder-cover board; pristine unbent form." },
  { id: 37, name: "Rep. Dennis Miller", role: "Agriculture Committee Lead", category: "Legislator", agenda: "Corn and ethanol subsidies; water deregulation.", quirks: "Leans back in chairs; tells rambling constituent stories.", cutout: "Brown corrugated cardboard with bent right ear/corner." },
  { id: 38, name: "Sen. Irene Gallagher", role: "Foreign Relations Lead", category: "Legislator", agenda: "Overseas sanctions; foreign democracy funding.", quirks: "Sips lukewarm herbal tea; speaks in cold, legalistic phrasing.", cutout: "Rigid museum mounting board; sharp right angles." },
  { id: 39, name: "Rep. Silas Vance", role: "Libertarian Maverick", category: "Legislator", agenda: "Slashing federal agencies; ending foreign interventions.", quirks: "Refuses party whips' calls; stands during hearings.", cutout: "Thin unlaminated board; visible bend at midsection." },
  { id: 40, name: "Rep. Maya Thorne", role: "Urban District Rep", category: "Legislator", agenda: "Mass transit grants; affordable tenant protections.", quirks: "Speaks without looking at notes; gestures with open hands.", cutout: "High-contrast printed board; razor-cut silhouette." },
  { id: 41, name: "Sen. Calvin Drake", role: "Defense Sub-Committee", category: "Legislator", agenda: "Naval shipyard contracts; private defense spending.", quirks: "Keeps military haircut; answers queries with single words.", cutout: "Hard-pressed green board; minor water spots along bottom." },
  { id: 42, name: "Rep. Andrea Sterling", role: "Ways & Means Member", category: "Legislator", agenda: "Corporate tax loopholes; capital gains reductions.", quirks: "Sharp, clipped laughter; adjusts expensive cufflinks.", cutout: "Semi-gloss card; neat die-cut with smooth white core." },
  { id: 43, name: "Sen. Gregory Hall", role: "Western Mining Rep", category: "Legislator", agenda: "Public land mining permits; federal deregulation.", quirks: "Cracks knuckles; wears bolo tie over rumpled collar.", cutout: "Weathered chipboard; rough fibrous separation at base." },
  { id: 44, name: "Rep. Beth Vance", role: "Suburban Swing Rep", category: "Legislator", agenda: "Suburban school safety; middle-class tax credits.", quirks: "Takes handwritten constituent notes; speaks softly.", cutout: "Clean white display board; slightly bowed in middle." },
  { id: 45, name: "Sen. Warren O'Neil", role: "Senior Banking Chair", category: "Legislator", agenda: "Wall Street deregulation; credit agency oversight.", quirks: "Glances at stock tickers on wristwatch; talks fast.", cutout: "Dark blue-inked board; neat die-cut with glossy lamination." },
  { id: 46, name: "Rep. Samira Khan", role: "Tech Corridor Rep", category: "Legislator", agenda: "Data privacy framework; AI research funding.", quirks: "Carries dual smartphones; interrupts to fact-check live.", cutout: "Thin synthetic cardstock; razor-clean laser margins." },
  { id: 47, name: "Sen. Leonard Potts", role: "Rural Plains Senator", category: "Legislator", agenda: "Rail freight freight-rate caps; rural broadband subsidies.", quirks: "Chews toothpick; pauses long seconds before responding.", cutout: "Coarse grain Kraft board; small grease spot on sleeve." },
  { id: 48, name: "Rep. Felix Ortega", role: "Former Mayor Lawmaker", category: "Legislator", agenda: "Community policing; federal municipal debt relief.", quirks: "Shakes hands with two hands; slaps shoulders.", cutout: "Thick standard display card; corner peeled back slightly." },
  { id: 49, name: "Sen. Monica Sharp", role: "Labor Sub-Committee", category: "Legislator", agenda: "Minimum wage indexation; union shop laws.", quirks: "Eyes narrow when crossed; references early work strikes.", cutout: "Reddish-tinted cardstock; minor staple holes near top." },
  { id: 50, name: "Rep. Preston Hayes", role: "Blue-Dog Centrist", category: "Legislator", agenda: "Balanced budget amendment; bipartisan compromise.", quirks: "Frowns thoughtfully; avoids taking positions on first ask.", cutout: "Pale grey paperboard; slight tape residue on back strut." },
  { id: 51, name: "Sen. Victoria Cruz", role: "Healthcare Committee", category: "Legislator", agenda: "Prescription drug price caps; hospital subsidies.", quirks: "Taps pen against chin; unyielding eye contact.", cutout: "Smooth laminated poster board; pristine perimeter cut." },
  { id: 52, name: "Rep. Toby Campbell", role: "Freedom Caucus Rep", category: "Legislator", agenda: "State nullification bills; defunding federal agencies.", quirks: "Shouts over gavels; holds up thick stacks of paper.", cutout: "Raw cardboard; jagged tear along left silhouette edge." },
  { id: 53, name: "Sen. Richard Ward", role: "Veteran Affairs Lead", category: "Legislator", agenda: "VA healthcare modernization; military pay hikes.", quirks: "Walks with stiff gait; addresses people as 'Sir' or 'Ma'am'.", cutout: "Heavy-duty chipboard; worn, scuffed finish along base." },
  { id: 54, name: "Rep. Nina Patel", role: "House Ethics Chair", category: "Legislator", agenda: "Campaign finance reform; anti-lobbying legislation.", quirks: "Never smiles in photos; keeps hands folded on desk.", cutout: "Crisp white poster board; ultra-sharp die-cut lines." },
  { id: 55, name: "Sen. Curtis Boyd", role: "Appropriations Chair", category: "Legislator", agenda: "Discretionary spending pork; infrastructure funding.", quirks: "Grins while delivering bad news; whispers behind hands.", cutout: "Faded cream cardstock; dog-eared lower-left corner." },
  { id: 56, name: "Pierce Sterling", role: "Venture Capital Titan", category: "Special Interest", agenda: "Deregulation of tech monopolies; crypto integration.", quirks: "Speaks in Silicon Valley jargon; paces restlessly.", cutout: "Glossy synth-board; reflective finish; crisp machine cut." },
  { id: 57, name: "Marlan Briggs", role: "Steel & Oil Conglomerate CEO", category: "Special Interest", agenda: "Fossil fuel subsidies; offshore drilling permits.", quirks: "Lights cigars in non-smoking rooms; gravelly drawl.", cutout: "Thick industrial matte board; faint greasy fingerprint mark." },
  { id: 58, name: "Judith Blair", role: "Prime-Time Cable Anchor", category: "Media", agenda: "Ratings, breaking scoops, televised confrontations.", quirks: "Tilts head dramatically; cuts off interviewees mid-breath.", cutout: "Studio-gloss print; visible bleed marks along edges." },
  { id: 59, name: "Roland Price", role: "Automotive Union Boss", category: "Special Interest", agenda: "Domestic EV manufacturing protections; strike threats.", quirks: "Talks with hands; raspy voice from years on bullhorns.", cutout: "Heavy corrugated packing cardboard; rough ribbed edges." },
  { id: 60, name: "Kendra Wu", role: "Pharmaceutical Lobbyist", category: "Special Interest", agenda: "Patent term extensions; opposing drug price controls.", quirks: "Smiles warmly while delivering implicit financial threats.", cutout: "Sleek linen-embossed card; perfectly sharp die-cut." },
  { id: 61, name: "Donald 'Mac' McAllister", role: "Independent Podcaster", category: "Media", agenda: "Anti-establishment theories; leaks and scandals.", quirks: "Shouts into dynamic mic; swigs water from mason jar.", cutout: "Newsprint pasted on rough board; torn jagged edges." },
  { id: 62, name: "Abigail Croft", role: "Mega-Church Pastor / PAC Head", category: "Special Interest", agenda: "Religious liberty exemptions; conservative family values.", quirks: "Closes eyes when speaking of politics; resonant preacher voice.", cutout: "Parchment-look cardboard; pristine uncreased surface." },
  { id: 63, name: "Tariq Vance", role: "Financial Times Columnist", category: "Media", agenda: "Market predictability; central bank independence.", quirks: "Pushes wire glasses up nose; relies strictly on charts.", cutout: "Plain recycled paperboard; light print registration drift." },
  { id: 64, name: "Vance Miller", role: "Agribusiness Lobbyist", category: "Special Interest", agenda: "Chemical fertilizer approvals; meatpacking deregulation.", quirks: "Wears expensive suits with cattleman boots; broad smile.", cutout: "Stiff craft card; faint bend near base from standing." },
  { id: 65, name: "Cynthia Drake", role: "Green NGO President", category: "Special Interest", agenda: "Ending oil leases; aggressive plastic bans.", quirks: "Sits bolt upright; quotes IPCC reports from memory.", cutout: "Raw flecked unbleached board; slightly rounded corners." },
  { id: 66, name: "Leonid Rostov", role: "Foreign Oligarch / Investor", category: "Special Interest", agenda: "Evading sanctions; real estate asset safety.", quirks: "Speaks through an assistant; checks encrypted phones.", cutout: "Heavy metallic-sheen cardstock; completely rigid." },
  { id: 67, name: "Sarah Jenkins", role: "Grassroots Organizer", category: "Civil Society", agenda: "Tenant rights; grassroots protest coordination.", quirks: "Carries megaphone; uses bold, punchy declarative slogans.", cutout: "Thin poster card; visible staple and tape marks on front." },
  { id: 68, name: "Hunter Reed", role: "Defense Contractor CEO", category: "Special Interest", agenda: "Foreign arms sales approvals; missile contract awards.", quirks: "Extremely polite; never talks money in open rooms.", cutout: "Matte charcoal cardstock; ultra-clean die-cut outline." },
  { id: 69, name: "Chloe Dubois", role: "Tabloid Managing Editor", category: "Media", agenda: "Presidential extramarital affairs; cabinet corruption leaks.", quirks: "Chews gum aggressively; talks over people on the phone.", cutout: "Cheap newsprint board; slightly faded, grainy ink dots." },
  { id: 70, name: "Dr. Russell Evans", role: "Think Tank Economist", category: "Special Interest", agenda: "Free-market privatization; deregulation of ports.", quirks: "Uses whiteboard markers during conversations; pedantic.", cutout: "Heavy greyboard; sharp square cuts; flat matte finish." },
  { id: 71, name: "Marlene Ortiz", role: "Nurses' Union President", category: "Special Interest", agenda: "Hospital staffing ratios; workplace safety rules.", quirks: "Direct, no-nonsense gaze; refuses political double-talk.", cutout: "Thick corrugated board; slight bend along left shoulder." },
  { id: 72, name: "Trevor Hall", role: "Private Prison Operator", category: "Special Interest", agenda: "Mandatory minimum sentencing; state prison contracts.", quirks: "Keeps hands in pockets; maintains uncomfortably flat tone.", cutout: "Stiff manila tag board; yellowed borders, clean cut." },
  { id: 73, name: "Gemma Stone", role: "Silicon Valley AI Exec", category: "Special Interest", agenda: "Federal AI compute subsidies; immunity from model liability.", quirks: "Talks at 1.5x speed; sips meal-replacement drinks.", cutout: "Glossy bright white board; laser-etched clean edges." },
  { id: 74, name: "Hank 'Duke' Snyder", role: "Talk Radio Host", category: "Media", agenda: "Blue-collar populism; attacking federal bureaucracy.", quirks: "Laughs sarcastically; bangs on desk during rants.", cutout: "Cheap pulp cardboard; bent upper corner; scuffed print." },
  { id: 75, name: "Elena Belova", role: "Sovereign Wealth Fund Rep", category: "Special Interest", agenda: "Securing port logistics; zero-tariff agricultural trade.", quirks: "Cold formal demeanor; offers gifts within legal limits.", cutout: "Heavyweight card with metallic gold stamped accents." },
  { id: 76, name: "Arturo Gomez", role: "Immigrant Rights Coalition Lead", category: "Civil Society", agenda: "Pathway to citizenship; ending border detentions.", quirks: "Passionate delivery; maintains intense, pleading eye contact.", cutout: "Flexible poster stock; reinforced with tape along back." },
  { id: 77, name: "Daphne Vance", role: "High-Society Fundraiser", category: "Special Interest", agenda: "Party gala donations; social status preservation.", quirks: "Speaks in hushed, elegant gossip; touches companion's forearm.", cutout: "Ivory cream board; delicate smooth die-cut profile." },
  { id: 78, name: "Craig Mercer", role: "Mining Association Head", category: "Special Interest", agenda: "Coal runoff waivers; rare-earth mining approvals.", quirks: "Wears mud-dusted utility jackets over dress shirts.", cutout: "Dark brown Kraft paperboard; fraying bottom edge." },
  { id: 79, name: "Vivian Lee", role: "Investigative Journalist", category: "Media", agenda: "Transparency FOIA requests; dark money exposure.", quirks: "Wears trench coat indoors; records every casual interaction.", cutout: "Manila cardstock; ink-smudged around cutout edges." },
  { id: 80, name: "Silas Thorne", role: "Banking Consortium Chair", category: "Special Interest", agenda: "Lowering reserve requirements; resisting digital currency.", quirks: "Dry, soft-spoken; gestures only with single finger taps.", cutout: "Thick archival greyboard; dead straight, unyielding." },
  { id: 81, name: "Prime Minister Alistair Ward", role: "Allied Nuclear Power", category: "Foreign Leader", agenda: "Preserving historic treaty; joint intelligence sharing.", quirks: "Crisp aristocratic accent; clears throat with subtle sarcasm.", cutout: "Smooth double-ply bristol board; sharp formal lines." },
  { id: 82, name: "Chancellor Greta Weiss", role: "European Union Leader", category: "Foreign Leader", agenda: "Carbon border adjustments; unified trade compliance.", quirks: "Sits with hands steepled; speaks with dry directness.", cutout: "Modern high-density card; matte finish, perfectly flat." },
  { id: 83, name: "President Raul Santos", role: "Latin American Partner", category: "Foreign Leader", agenda: "Inter-American drug control; agricultural export access.", quirks: "Warm smile; gestures with both hands during diplomacy.", cutout: "Standard cardstock; slight sun-fading along top edge." },
  { id: 84, name: "Premier Zhou Kang", role: "Global Rival Superpower", category: "Foreign Leader", agenda: "Expanding naval spheres; chip export parity.", quirks: "Expressionless face; waits five full seconds before replying.", cutout: "Heavy red-backed board; dead straight industrial cut." },
  { id: 85, name: "Gen. Idriss Traore", role: "West African Junta Leader", category: "Foreign Leader", agenda: "Sanctions relief; bilateral security guarantees.", quirks: "Stands at rigid parade rest; wears full dress medals.", cutout: "Coarse military board; slight water warp on right side." },
  { id: 86, name: "Prime Minister Sunita Rao", role: "Indo-Pacific Ally", category: "Foreign Leader", agenda: "Naval defense treaties; non-aligned trade rights.", quirks: "Rapid, razor-sharp debater; shifts easily from warm to stern.", cutout: "High-gloss sturdy card; crisp machine-pressed edges." },
  { id: 87, name: "Crown Prince Faisal Al-Hassan", role: "Middle Eastern Ally", category: "Foreign Leader", agenda: "Arms contracts; sovereign wealth domestic investments.", quirks: "Quiet confidence; rarely looks directly at junior staff.", cutout: "Heavy card with gold-foil edge trim; pristine cut." },
  { id: 88, name: "President Taras Boyko", role: "Frontline Allied Nation", category: "Foreign Leader", agenda: "Immediate military hardware deliveries; NATO integration.", quirks: "Tired eyes; wears olive fleece; urgent, direct speech.", cutout: "Raw cardboard; visible stress folds at knees and neck." },
  { id: 89, name: "President Kenji Sato", role: "East Asian Ally", category: "Foreign Leader", agenda: "Joint missile shields; regional sea lane safety.", quirks: "Bows formally before shaking hands; soft, careful speech.", cutout: "White museum board; flawless, sharp silhouette." },
  { id: 90, name: "President Nikolai Volkov", role: "Rogue State Adversary", category: "Foreign Leader", agenda: "Disrupting Western alliances; cyber warfare freedom.", quirks: "Smirks dismissively at diplomatic warnings; leans back.", cutout: "Thick chipboard; matte black finish with worn white edges." },
  { id: 91, name: "Dorothy Miller", role: "Midwestern Factory Worker", category: "Citizen", agenda: "Keeping plant open; domestic manufacturing tariffs.", quirks: "Crosses arms tight; looks skeptically at politicians.", cutout: "Standard corrugated board; exposed cardboard fluting at base." },
  { id: 92, name: "Tyler Jensen", role: "Gig Economy Driver", category: "Citizen", agenda: "Gas price relief; classifying gig workers as staff.", quirks: "Checks rideshare app constantly; holds paper coffee cup.", cutout: "Flimsy poster board; heavily taped along rear cardboard strut." },
  { id: 93, name: "Maria Sanchez", role: "Suburban Teacher", category: "Citizen", agenda: "Classroom supplies funding; mental health resources.", quirks: "Speaks with gentle patience; carries heavy tote of papers.", cutout: "Thin craft board; visible crease line across left arm." },
  { id: 94, name: "Frank 'Mac' MacIntyre", role: "Hardware Store Owner", category: "Citizen", agenda: "Small business tax relief; reducing commercial power bills.", quirks: "Wipes palms on trousers; sighs at bureaucratic forms.", cutout: "Coarse brown Kraft paperboard; dented right shoulder." },
  { id: 95, name: "Aaliyah Taylor", role: "Student Activist", category: "Citizen", agenda: "Total student loan cancellation; divestment mandates.", quirks: "Holds handmade protest signs; speaks with urgent fire.", cutout: "Bright colored poster paper; jagged hand-cut scissor edges." },
  { id: 96, name: "Officer Jim Kowalski", role: "Police Sergeant", category: "Citizen", agenda: "Police department funding; qualified immunity defense.", quirks: "Hands on belt; looks people up and down before speaking.", cutout: "Heavy blue cardstock; clean cut; scuffed right corner." },
  { id: 97, name: "Dr. Aris Thorne", role: "ER Resident Physician", category: "Citizen", agenda: "Public health funding; nurse-to-patient staffing caps.", quirks: "Dark circles under eyes; taps foot rapidly when waiting.", cutout: "Smooth white board; thin ink registration mark on collar." },
  { id: 98, name: "Clarence Boyd", role: "Fixed-Income Senior", category: "Citizen", agenda: "Social security COLA hikes; prescription cost cuts.", quirks: "Cups hand behind ear; repeats questions to ensure accuracy.", cutout: "Yellowed archival paperboard; visible bend across midsection." },
  { id: 99, name: "Rosa Delgado", role: "Port Trucker", category: "Citizen", agenda: "Ending port delays; diesel fuel subsidies.", quirks: "Wears reflective vest; direct, blunt speech with no filter.", cutout: "Heavy corrugated packing board; rough fibrous perimeter." },
  { id: 100, name: "Devon Washington", role: "Veteran & Small Farmer", category: "Citizen", agenda: "Drought relief funds; VA mental health access.", quirks: "Speaks softly but looks directly into eyes; calm demeanor.", cutout: "Earthy Kraft board; light grease/water stain along base." },
  { id: 101, name: "Secretary-General Amira Zouari", role: "UN Global League Sec-Gen", category: "Multilateral Body", agenda: "Ceasefire enforcement; humanitarian corridor guarantees; protecting international law.", quirks: "Speaks in immaculate unhurried diplomatic English; taps fountain pen three times before ruling out of order.", cutout: "Archival cream museum board; crisp gold-foil seal stamped at base; faint crease at shoulder from travel storage." },
  { id: 102, name: "Prime Minister Kaspar Lindqvist", role: "Nordic Energy Coalition Leader", category: "Western Ally", agenda: "Critical undersea cable protection; strict carbon cross-border duties; sovereign debt green bonds.", quirks: "Direct low-volume speech; takes brisk walks between sessions; never removes charcoal wool overcoat.", cutout: "Matte arctic-white cardstock; laser-die cut silhouette; tiny tear on bottom stand from tight packing." },
  { id: 103, name: "President Mateo Cárdenas", role: "Andean Lithium Bloc Chairman", category: "Regional Power", agenda: "State-controlled lithium extraction cartels; renegotiating IMF sovereign loan terms.", quirks: "Smiles disarmingly while delivering hard non-negotiable trade ultimatums; rolls pencil between knuckles.", cutout: "Warm clay-toned craft card; slight water wrinkle near cuff from spilled mineral water." },
  { id: 104, name: "Foreign Minister Leila Al-Ghamdi", role: "Gulf Energy & AI Envoy", category: "Middle Eastern Partner", agenda: "Sovereign wealth data center investments; guaranteed defense umbrellas; visa reciprocity.", quirks: "Glances toward security detail before answering high-stakes queries; impeccably calm and calculated.", cutout: "Heavy linen-textured card; metallic bronze edge trim; pristine rigid strut backing." },
  { id: 105, name: "Prime Minister Declan MacIntyre", role: "Celtic Offshore Financial Hub", category: "Allied Trading Partner", agenda: "Protecting low corporate tax status; opposing multinational digital service taxes.", quirks: "Leans forward with affable charm; defuses heated sanctions talks with dry self-deprecating jokes.", cutout: "Standard double-ply card; faint coffee cup ring on lower coat lapel; sharp die-cut profile." },
  { id: 106, name: "President Batbayar Erdene", role: "Central Asian Buffer State Leader", category: "Non-Aligned Bloc", agenda: "Balancing rival superpowers on border; secure rare-earth rail transport corridors.", quirks: "Listens with intense unblinking stillness; answers only in concise three-sentence statements.", cutout: "Dense industrial greyboard; fibrous coarse edging along shoulders; slight bow in midsection." },
  { id: 107, name: "Ambassador Jean-Luc Mercier", role: "Chief Trade Negotiator", category: "Multilateral Body", agenda: "Intellectual property harmonisation; agricultural tariff protections for domestic farmers.", quirks: "Adjusts wire-rim tortoise glasses; pulls laminated annex charts from vintage leather portfolio.", cutout: "Semi-gloss presentation stock; visible CMYK color bar left intentionally on bottom tab; rigid cut." },
  { id: 108, name: "President Kojo Mensah", role: "West African Economic Community Chair", category: "Regional Power", agenda: "Pan-African currency stabilization; ending Western mineral export restrictions.", quirks: "Booming rhythmic baritone; places both palms flat on the negotiating table to signal agreement.", cutout: "Heavy unbleached Kraft board; vibrant printed kente textile collar; scotch tape on rear support strut." },
  { id: 109, name: "Premier Lin Hai-Rong", role: "Special Economic Envoy", category: "Rival Superpower", agenda: "Securing semiconductor supply chains; undermining maritime navigation sanctions.", quirks: "Maintains a mild polite poker face; relies strictly on pre-cleared red-folder brief cards.", cutout: "Pristine satin-finish poster board; high-density core; precision-cut razor edges with no scuffs." },
  { id: 110, name: "President Vlatko Danilović", role: "Balkan Corridor Prime Minister", category: "Non-Aligned Bloc", agenda: "Playing Western infrastructure grants against Eastern pipeline loans; visa-free transit.", quirks: "Smokes e-cigarettes nervously in hallways; constantly consults dual flip phones.", cutout: "Cheap recycled news-card; dog-eared right elbow; visible fold crease where figure was stored flat." },
  { id: 111, name: "High Commissioner Fiona Campbell", role: "Commonwealth Trade Emissary", category: "Diplomatic Corps", agenda: "Free-trade dispute arbitration; fishing zone quotas; climate damage compensation fund.", quirks: "Checks legal treaty text with yellow highlighter; never signs until third draft.", cutout: "Rigid pale-ivory cardstock; brass eyelet punched through header for identification lanyard." },
  { id: 112, name: "Foreign Minister Santiago Beltrán", role: "Southern Cone Grain Power", category: "Regional Ally", agenda: "Emergency grain export waivers; fertilizer shipment protections; regional currency swaps.", quirks: "Stands hands-in-pockets during formal photos; delivers sharp impromptu press soundbites.", cutout: "Sturdy standard cardstock; slight paper peel along base where wood stand grips." },
  { id: 113, name: "President Aruna Senanayake", role: "Island Maritime Chokepoint Leader", category: "Non-Aligned Bloc", agenda: "Deep-water port lease auctions; sovereign debt restructuring; naval port access parity.", quirks: "Polite quiet delivery; leverages naval basing rights against both Western and Eastern powers.", cutout: "Smooth bristol board; clean white cut; subtle fingerprint oil mark on lower hem." },
  { id: 114, name: "Grand Duke Maximilian von Keller", role: "European Microstate Sovereign", category: "Western Ally", agenda: "Private banking privacy protections; diplomatic passport sovereignty; art asset storage.", quirks: "Speaks four languages interchangeably; looks mildly bored by standard protocol.", cutout: "Extra-thick gilded museum board; gold leaf along perimeter; perfectly pristine upright stance." },
  { id: 115, name: "Ambassador Tariq Al-Jamil", role: "OPEC+ Strategy Spokesman", category: "Special Interest", agenda: "Oil production quotas; coordinating sudden crude price floors; petrochemical transition subsidies.", quirks: "Slow deliberate hand gestures; sips mint tea throughout tense closed-door plenaries.", cutout: "Heavy dark matte board; ultra-clean die-cut outline; minor scuffing on left cuff." },
  { id: 116, name: "President Danuta Wiśniewska", role: "Eastern Borderland Frontier Leader", category: "Frontline Ally", agenda: "Forward missile battery deployments; permanent treaty bases; emergency grain embargoes.", quirks: "Unsmiling vigilant posture; speaks with rapid unvarnished bluntness; refuses small talk.", cutout: "Coarse military-grade cardstock; faint vertical stress fold across knees; olive backing." },
  { id: 117, name: "Special Envoy Chenault Beau Vance", role: "Special Presidential Envoy for Hostages", category: "Executive Staff", agenda: "Discreet back-channel prisoner swaps; unfreezing restricted humanitarian funds.", quirks: "Travels under diplomatic cover; speaks in whispered hypotheticals over corridor water coolers.", cutout: "Weathered manila board; corners rounded from pocket travel; small staples visible on lapel." },
  { id: 118, name: "Prime Minister Sione Tuipulotu", role: "Pacific Island Atoll Alliance Voice", category: "Civil Society", agenda: "Loss and damage climate reparations; sea-level refugee status; tuna territorial waters.", quirks: "Speaks with solemn quiet moral weight; holds a carved wooden ceremonial token during speeches.", cutout: "Eco-kraft pulp board; visible natural plant fibers; hand-trimmed scissor perimeter." },
  { id: 119, name: "President General Hector Solano", role: "Trans-Isthmus Canal State Strongman", category: "Strategic Partner", agenda: "Canal toll hike sovereignty; military counter-cartel funding; unilateral border closures.", quirks: "Wears dress uniform with aviator glasses indoors; taps cigar cutter against microphone.", cutout: "Glossy coated chipboard; slight separation of laminated print layer at the left boot." },
  { id: 120, name: "Director General Dr. Miriam Nygård", role: "World Health & Bio-Security Lead", category: "Multilateral Body", agenda: "Vaccine patent sharing mandates; global pathogen early-warning surveillance pacts.", quirks: "Tired eyes behind rimless spectacles; interrupts heads of state with statistical mortality charts.", cutout: "Clinical white cardboard; faint printer alignment target visible on bottom right foot." },
];

const BY_NAME = new Map(ROSTER.map((p) => [p.name, p]));

/** The one person behind a name, if the name is in the roster. */
export function rosterByName(name: string): RosterPerson | undefined {
  return BY_NAME.get(name);
}

export function rosterByCategory(category: RosterCategory): RosterPerson[] {
  return ROSTER.filter((p) => p.category === category);
}

export const ROSTER_CATEGORIES: RosterCategory[] = [
  "Executive Staff",
  "Cabinet",
  "Legislator",
  "Special Interest",
  "Media",
  "Civil Society",
  "Foreign Leader",
  "Multilateral Body",
  "Western Ally",
  "Regional Power",
  "Middle Eastern Partner",
  "Allied Trading Partner",
  "Non-Aligned Bloc",
  "Rival Superpower",
  "Diplomatic Corps",
  "Regional Ally",
  "Frontline Ally",
  "Strategic Partner",
  "Citizen",
];

/**
 * Categories that name a foreign or international actor rather than
 * someone on the domestic side of the fence — everyone `diplomacy.ts`
 * treats as a world leader you can reach on the Secure Line. "Foreign
 * Leader" was the original, single bucket for this; the rest split that
 * same idea into the specific kind of relationship each one is (an ally,
 * a rival, a multilateral body, a non-aligned power...).
 */
export const DIPLOMATIC_CATEGORIES: RosterCategory[] = [
  "Foreign Leader",
  "Multilateral Body",
  "Western Ally",
  "Regional Power",
  "Middle Eastern Partner",
  "Allied Trading Partner",
  "Non-Aligned Bloc",
  "Rival Superpower",
  "Diplomatic Corps",
  "Regional Ally",
  "Frontline Ally",
  "Strategic Partner",
];

/** Categories a person could plausibly be appointed to a cabinet office from. */
export const CABINET_ELIGIBLE_CATEGORIES: RosterCategory[] = ["Cabinet", "Executive Staff"];
