import type { WendTheme } from "./types";

/**
 * The English word bank. Same shape and same rules as the Portuguese one in
 * pt-br.ts: one word per entry, 3 to 12 letters, letters only, no hyphen and no
 * space, and words of many different lengths in every theme, because a board
 * is filled with one word per length. tests/wend/bank.test.ts enforces all of
 * this, and checks that every theme can fill every board of every tier.
 *
 * Spelling is British, like the English interface: colour, grey, theatre,
 * aluminium, yoghurt, organise. Where the two sides of the Atlantic use
 * different words, the British one is here: lorry, trousers, aubergine, tap.
 *
 * No proper nouns and no brand names. That is why there are no countries,
 * planets, weekdays or months, which English writes with a capital.
 *
 * Changing a word changes the puzzles that seeds build. Add a generator version
 * in seed.ts before editing a theme that has shipped.
 */
export const WEND_THEMES: readonly WendTheme[] = [
  {
    title: "Fruits",
    words: "fig pear plum lime kiwi date apple lemon melon mango peach grape guava olive berry banana orange cherry papaya damson lychee quince raisin pomelo apricot avocado coconut currant satsuma kumquat mandarin mulberry honeydew bilberry plantain blueberry raspberry cranberry nectarine pineapple persimmon tangerine greengage clementine strawberry grapefruit blackberry watermelon gooseberry redcurrant elderberry cantaloupe pomegranate blackcurrant",
  },
  {
    title: "On the farm",
    words: "cow pig hen ram ewe hay sty barn bull calf lamb goat duck foal mare crop gate herd mule oats pond hive coop silo horse sheep goose field fence straw wheat maize dairy flock grain cattle donkey farmer piglet plough stable turkey barley meadow trough tractor orchard paddock pasture chicken harvest rooster cowshed cockerel farmyard sheepdog haystack shepherd windmill farmland scarecrow farmhouse livestock pitchfork horseshoe beekeeper cultivator fertiliser wheelbarrow weathervane agriculture countryside smallholding",
  },
  {
    title: "Wild animals",
    words: "ape bat elk fox gnu yak bear deer lion lynx puma wolf boar hare mole toad camel hyena koala lemur llama moose otter panda rhino sloth tiger zebra bison baboon badger beaver cougar coyote gibbon jackal jaguar monkey ocelot weasel buffalo cheetah giraffe gorilla leopard meerkat panther raccoon gazelle wallaby warthog opossum caribou lemming aardvark antelope elephant hedgehog kangaroo mongoose platypus reindeer squirrel anteater chipmunk armadillo crocodile orangutan porcupine wolverine alligator chimpanzee rhinoceros wildebeest rattlesnake hippopotamus",
  },
  {
    title: "In the kitchen",
    words: "cup jug mug pan pot wok lid jar tin hob bowl dish fork oven sink tray knife ladle tongs sieve spoon plate glass grill apron timer towel whisk scales kettle grater peeler teapot cooker fridge saucer juicer larder pestle recipe blender freezer toaster spatula cutlery worktop cupboard colander saucepan teaspoon crockery cookbook corkscrew microwave dishcloth casserole extractor tablespoon dishwasher liquidiser chopsticks breadboard tablecloth thermometer kitchenware refrigerator",
  },
  {
    title: "Colours",
    words: "red tan blue cyan gold grey jade lime navy pink plum rose ruby teal rust amber beige black brown coral cream green ivory khaki lemon lilac mauve ochre olive peach sepia white auburn bronze cerise cobalt copper indigo maroon orange purple salmon silver violet yellow crimson emerald magenta mustard scarlet apricot burgundy charcoal lavender sapphire mahogany chestnut turquoise vermilion tangerine chocolate champagne aquamarine terracotta periwinkle ultramarine",
  },
  {
    title: "The human body",
    words: "arm ear eye hip jaw leg lip rib toe gum back bone calf chin foot hair hand head heel knee lung nail neck nose palm shin skin vein brow ankle brain cheek chest elbow heart liver mouth navel spine thigh thumb tooth wrist waist blood finger kidney muscle tongue throat temple tendon artery nostril eyebrow eyelash knuckle stomach forearm ribcage earlobe abdomen kneecap shoulder skeleton forehead ligament backbone windpipe intestine cartilage fingertip collarbone fingernail bloodstream",
  },
  {
    title: "Sports",
    words: "gym golf judo polo pool luge sumo rugby bowls darts relay boxing diving hockey karate rowing skiing squash tennis netball cricket sailing archery fencing curling surfing running snooker hurdles javelin cycling football handball softball baseball swimming climbing canoeing lacrosse marathon rounders kayaking athletics badminton wrestling triathlon basketball gymnastics volleyball showjumping snowboarding orienteering trampolining",
  },
  {
    title: "Musical instruments",
    words: "drum harp horn lute lyre oboe tuba gong bell fife banjo bugle cello flute organ piano viola sitar kazoo cornet fiddle guitar violin zither cymbal bongos bassoon maracas ukulele trumpet piccolo timpani whistle clarinet trombone recorder mandolin triangle bagpipes keyboard accordion harmonica saxophone xylophone euphonium castanets tambourine concertina kettledrum didgeridoo harpsichord synthesiser glockenspiel",
  },
  {
    title: "Jobs",
    words: "vet chef cook maid poet actor baker judge nurse pilot tutor vicar miner guard artist author barber butler dancer doctor farmer lawyer singer tailor waiter writer banker editor grocer builder butcher cashier dentist painter plumber surgeon teacher postman chemist soldier cleaner florist gardener engineer mechanic optician reporter sculptor musician lecturer novelist architect carpenter scientist secretary zookeeper librarian detective paramedic astronaut caretaker journalist accountant programmer pharmacist bricklayer fishmonger electrician firefighter hairdresser photographer receptionist",
  },
  {
    title: "At school",
    words: "pen art gym book desk exam test bell hall quiz glue chalk class essay paper pupil ruler study maths break lunch board pencil rubber lesson school folder crayon locker history science reading uniform teacher library satchel project student compass spelling homework notebook register textbook rucksack geometry assembly classroom geography timetable sharpener playground whiteboard blackboard dictionary arithmetic calculator mathematics headteacher",
  },
  {
    title: "Weather",
    words: "fog sun ice dew sky gale hail heat mist rain smog snow thaw wind cold gust warm haze cloud flood frost sleet storm sunny windy misty humid chill breeze shower squall icicle deluge puddle cloudy freeze drizzle drought climate cyclone monsoon rainbow thunder tornado typhoon tempest blizzard downpour forecast heatwave humidity sunshine snowfall rainfall overcast raindrop hailstorm hurricane lightning snowflake snowstorm barometer whirlwind cloudburst temperature thunderclap meteorology thunderstorm",
  },
  {
    title: "Family",
    words: "mum dad son nan kin aunt baby twin wife uncle niece child bride groom mummy daddy mother father sister cousin nephew parent spouse brother husband grandma grandpa sibling partner stepson toddler daughter grandson relative ancestor godchild triplets children godmother godfather offspring grandchild stepfather stepmother stepsister generation grandmother grandfather grandparent stepbrother stepdaughter relationship",
  },
  {
    title: "At the beach",
    words: "sea sun tan bay sand surf tide wave crab dune pier boat reef cove kite gull shell coast shore towel spade beach ocean float bucket pebble bikini sandal lagoon lotion sunset paddle trunks picnic seaweed seaside surfing swimmer parasol snorkel sunburn wetsuit seagull sunshine lifeboat seashell swimsuit starfish sandbank swimming deckchair lifeguard surfboard sunscreen promenade windbreak jellyfish driftwood sandcastle sunglasses lighthouse volleyball paddleboard holidaymaker",
  },
  {
    title: "Transport",
    words: "bus car cab van jet bike boat ship taxi tram raft cart coach ferry lorry train plane yacht canoe kayak barge wagon moped glider rocket tanker tandem dinghy sledge bicycle minibus scooter tractor trailer caravan gondola airship balloon aircraft airliner tricycle unicycle monorail rickshaw lifeboat ambulance motorbike submarine speedboat limousine helicopter motorcycle hovercraft locomotive skateboard underground",
  },
  {
    title: "Flowers",
    words: "bud iris lily rose posy aster daisy lilac lotus pansy peony poppy tulip lupin azalea crocus dahlia orchid violet clover mimosa zinnia begonia freesia jasmine petunia anemone cowslip heather blossom bouquet bluebell camellia daffodil foxglove geranium hyacinth lavender magnolia marigold primrose snowdrop hibiscus wisteria buttercup carnation dandelion sunflower hollyhock narcissus gladiolus edelweiss delphinium snapdragon nasturtium cornflower honeysuckle rhododendron",
  },
  {
    title: "Vegetables",
    words: "pea yam bean kale leek corn okra chard cress onion swede maize carrot celery fennel garlic lentil marrow potato radish tomato turnip sprout pepper squash endive cabbage lettuce parsnip pumpkin shallot spinach gherkin beetroot broccoli cucumber mushroom celeriac chickpea kohlrabi artichoke asparagus aubergine courgette sweetcorn butternut watercress beansprout cauliflower horseradish",
  },
  {
    title: "Clothes",
    words: "cap hat tie bib belt boot coat gown hood robe sock suit vest kilt sari cape apron dress glove jeans scarf shirt skirt frock cloak anorak blouse bonnet jacket jumper mitten sandal shorts tights fleece hoodie poncho beanie pyjamas sweater uniform leotard wellies cardigan trousers trainers raincoat swimsuit overalls leggings slippers waistcoat dungarees tracksuit balaclava sweatshirt nightdress underclothes",
  },
  {
    title: "At the café",
    words: "tea cup mug bun jam cake menu milk roll soup tart chai latte mocha juice scone toast sugar spoon table cream bagel coffee muffin teapot waiter saucer napkin pastry panini biscuit brownie crumpet teacake barista cordial espresso lemonade smoothie sandwich flapjack croissant milkshake macchiato cappuccino cheesecake shortbread marshmallow",
  },
  {
    title: "Sweets and desserts",
    words: "pie jam bun cake tart flan mint fudge icing jelly lolly wafer scone sweet toffee mousse trifle sorbet nougat sundae eclair muffin humbug caramel custard pudding brownie truffle pancake pavlova crumble sherbet doughnut meringue macaroon flapjack lollipop marzipan chocolate liquorice shortcake cheesecake candyfloss shortbread marshmallow gingerbread butterscotch",
  },
  {
    title: "Furniture",
    words: "bed cot rug mat desk sofa lamp bunk seat bench chair couch shelf stool table chest futon bureau carpet drawer mirror settee pillow cradle locker cabinet cushion dresser hammock ottoman armchair bookcase cupboard mattress wardrobe recliner bedstead footrest footstool sideboard bookshelf headboard chandelier candlestick",
  },
  {
    title: "Around the house",
    words: "den door hall loft roof room wall step sill tile path gate shed attic floor porch study patio brick fence cellar garage garden larder pantry window toilet stairs gutter lounge hearth bedroom ceiling chimney kitchen landing hallway doorway balcony nursery veranda basement bathroom doorbell driveway corridor skylight doorstep fireplace staircase courtyard letterbox downstairs windowsill mantelpiece conservatory",
  },
  {
    title: "Tools",
    words: "axe saw awl file nail rake vice bolt pick drill clamp level lathe plane screw spade wedge anvil tongs brush knife chisel hammer mallet pliers shovel trowel ladder shears sander jigsaw spanner hacksaw crowbar pincers toolbox scraper scissors tweezers penknife chainsaw workbench sandpaper blowtorch secateurs paintbrush screwdriver wheelbarrow sledgehammer",
  },
  {
    title: "Space",
    words: "sun moon star dust void nova halo comet orbit probe rover space alien solar lunar galaxy meteor nebula planet rocket cosmos crater quasar pulsar launch eclipse gravity shuttle capsule sunspot equinox airlock asteroid universe stardust spaceman astronaut satellite spaceship supernova telescope cosmonaut meteorite starlight spacewalk atmosphere spacecraft weightless observatory interstellar",
  },
  {
    title: "Sea life",
    words: "cod eel ray crab clam fish seal tuna orca kelp sole hake coral shark squid whale prawn krill skate conch oyster salmon shrimp turtle walrus mussel plaice urchin cockle limpet marlin sponge dolphin lobster octopus anemone seaweed herring sardine narwhal haddock manatee starfish seahorse stingray plankton barnacle mackerel porpoise flounder jellyfish swordfish angelfish barracuda cuttlefish",
  },
  {
    title: "Birds",
    words: "owl hen jay emu crow dove duck gull hawk kiwi lark swan wren rook tern kite ibis coot eagle finch goose heron raven robin stork crane macaw quail swift egret canary cuckoo falcon magpie parrot pigeon puffin thrush turkey osprey toucan condor linnet budgie ostrich peacock pelican penguin sparrow swallow vulture seagull buzzard kestrel chicken skylark mallard flamingo starling pheasant cockatoo parakeet nuthatch albatross blackbird cormorant partridge chaffinch goldfinch kingfisher woodpecker budgerigar hummingbird nightingale sparrowhawk yellowhammer",
  },
  {
    title: "Insects and bugs",
    words: "ant bee bug fly web flea gnat moth slug wasp worm grub mite tick hive nest aphid snail larva midge louse drone sting beetle cicada earwig hornet locust maggot spider mantis weevil cocoon bedbug cricket firefly termite antenna ladybird mosquito greenfly horsefly honeybee silkworm bumblebee butterfly centipede cockroach dragonfly earthworm millipede woodlouse tarantula bluebottle grasshopper caterpillar",
  },
  {
    title: "Technology",
    words: "app bit web byte chip code data disk file icon link menu blog font game site cable email mouse pixel robot video modem drone phone click virus camera cursor laptop screen server tablet router folder online upload scroll button webcam browser desktop monitor network printer program speaker website display charger console battery computer download internet keyboard password software hardware joystick username database microchip processor algorithm interface smartphone headphones microphone attachment spreadsheet touchscreen loudspeaker",
  },
  {
    title: "Football",
    words: "net cup ball boot foul goal kick pass post save shot team half club fans draw wing bench coach cross pitch score derby final medal shirt match corner header keeper league player tackle trophy volley winger captain dribble forward referee stadium striker whistle penalty offside booking sweeper crossbar defender linesman handball champion midfield transfer goalmouth supporter touchline scoreline goalkeeper midfielder tournament substitute goalscorer floodlights championship",
  },
  {
    title: "Feelings",
    words: "joy awe calm envy fear hope love rage glee pity anger bliss grief pride shame worry trust shock dread cheer sorrow relief regret horror wonder delight sadness boredom anxiety courage passion elation despair comfort surprise kindness gladness sympathy calmness optimism happiness curiosity gratitude nostalgia confusion amusement tiredness affection eagerness excitement loneliness tenderness confidence compassion nervousness frustration contentment satisfaction cheerfulness",
  },
  {
    title: "Landscapes",
    words: "bay bog fen sea cave cove dune hill lake moor peak pond reef vale glen isle crag mesa beach cliff coast creek delta field marsh ridge river shore swamp gorge fjord heath atoll oasis plain canyon desert forest island jungle lagoon meadow stream valley tundra ravine summit geyser glacier volcano plateau prairie estuary harbour mountain woodland moorland foothill hillside seashore headland savannah waterfall peninsula coastline grassland riverbank rainforest wilderness countryside archipelago mountainside",
  },
  {
    title: "At the office",
    words: "pen bin mug desk file memo note boss team post clip copy form chair email paper phone staff diary inbox stamp badge clerk binder folder laptop pencil report screen office drawer letter meeting printer stapler manager invoice cabinet monitor planner project notepad calendar computer deadline envelope keyboard notebook document scissors employee colleague secretary clipboard telephone briefcase newsletter calculator whiteboard stationery photocopier highlighter appointment spreadsheet receptionist presentation",
  },
  {
    title: "On the menu",
    words: "pie egg ham soup stew rice beef lamb pork fish roll wrap mash taco naan tofu pasta pizza salad curry toast bacon gravy sushi chips kebab steak bread sauce burger pastry quiche hotpot paella cheese salami waffle nachos lasagne pancake sausage risotto burrito pudding noodles chowder ravioli sandwich omelette porridge dumpling macaroni meatball couscous moussaka spaghetti casserole hamburger minestrone beefburger cannelloni tagliatelle ratatouille cheeseburger",
  },
  {
    title: "Herbs and spices",
    words: "bay dill mint sage salt mace herb basil clove cumin thyme chive caper fennel garlic ginger nutmeg pepper chilli sesame borage sorrel mustard oregano paprika parsley saffron vanilla caraway chervil aniseed cinnamon rosemary tarragon turmeric marjoram cardamom allspice lavender coriander spearmint fenugreek peppermint lemongrass peppercorn horseradish",
  },
  {
    title: "Toys and games",
    words: "toy bat top ball dice doll kite bike drum game ludo hoop snap chess cards darts teddy robot train slide bingo swing jacks marble puzzle rattle puppet bricks blocks skates jigsaw balloon marbles scooter bicycle conkers dominoes draughts charades skittles football hopscotch playhouse trampoline skateboard backgammon roundabout tiddlywinks",
  },
  {
    title: "Film and theatre",
    words: "act cue set cast film play role plot star hero show seat mask prop mime actor drama scene stage opera usher farce extra cinema comedy screen script ticket sequel studio camera encore chorus actress curtain costume musical popcorn theatre trailer matinee balcony scenery cartoon tragedy villain audience director producer applause interval subtitle premiere animation character rehearsal spotlight pantomime backstage playwright soundtrack screenplay performance blockbuster documentary scriptwriter",
  },
  {
    title: "Health",
    words: "flu jab ache cold cure pill rash ward germ scan drip swab cough fever nurse pulse virus sling tonic doctor clinic remedy tablet sneeze splint health injury bandage plaster vaccine surgery patient chemist allergy illness therapy capsule syringe symptom hospital medicine ointment pharmacy headache exercise stitches crutches ambulance injection treatment operation emergency infection diagnosis paramedic toothache wheelchair medication antibiotic thermometer stethoscope appointment temperature prescription",
  },
  {
    title: "In town",
    words: "bus pub zoo inn cab bank park road shop kerb lane taxi sign hall flat gate quay hotel plaza alley block kiosk stall tower court depot bridge church cinema garage market museum school square street subway avenue bakery office tunnel statue library station theatre chemist gallery stadium factory traffic pavement fountain hospital monument crossing junction bookshop building cathedral newsagent restaurant roundabout skyscraper crossroads playground university pedestrian supermarket launderette marketplace underground",
  },
  {
    title: "Maths",
    words: "add sum odd area cone cube even half plus zero data line unit axis mean mode angle digit equal graph minus prime ratio times total count curve depth width point power proof chart table circle number radius square sphere volume factor height length median oblong divide double metric vertex symbol algebra decimal formula polygon pyramid average integer divisor hexagon octagon measure product rhombus compass addition division equation fraction triangle diameter pentagon cylinder multiply negative positive quotient symmetry subtract parallel gradient geometry rectangle perimeter numerator trapezium remainder calculate kilometre percentage arithmetic hypotenuse protractor semicircle calculator centimetre denominator subtraction probability coordinates tessellation intersection trigonometry",
  },
  {
    title: "Time",
    words: "day age era now date hour week year noon dawn dusk term past late soon time clock month night today watch early epoch delay alarm autumn decade minute moment second spring summer winter season sunset midday future period annual weekly century evening holiday morning weekend tonight sunrise weekday instant bedtime daytime teatime quarter calendar midnight tomorrow birthday deadline schedule lifetime twilight eternity duration afternoon fortnight yesterday timetable stopwatch hourglass lunchtime nightfall millennium wristwatch dinnertime generation anniversary",
  },
  {
    title: "Camping",
    words: "map peg log mug camp fire hike tent rope pole path lamp wood trek knot site torch trail stove stars boots flask smoke match woods cabin kayak canoe forest mallet kettle picnic stream nature hiking poncho embers anorak compass lantern matches blanket caravan bonfire hammock campfire campsite firewood rucksack backpack penknife wildlife mosquito barbecue footpath woodland adventure riverside firelight guidebook tarpaulin binoculars waterproof stargazing torchlight wilderness groundsheet marshmallow countryside orienteering",
  },
  {
    title: "Myths and legends",
    words: "elf imp orc hero king myth ogre mage wand yeti lair rune seer bard fate oath dwarf fairy giant gnome magic quest spell troll witch queen sword crown curse charm beast nymph genie ghost pixie fable castle dragon goblin knight legend wizard sprite shield potion throne prince sphinx oracle zombie riddle amulet banshee centaur griffin mermaid monster phoenix unicorn vampire warlock dungeon kingdom sorcery villain warrior werewolf basilisk treasure princess sorcerer talisman cauldron folklore prophecy labyrinth sorceress broomstick leprechaun enchantment shapeshifter",
  },
  {
    title: "Money",
    words: "pay tax tip fee bank bill cash coin cost debt loan note rent sale fund safe gold save sell earn wage till fare fine price purse money penny pound wages spend worth funds bonus vault share value debit trade budget change cheque credit profit salary wallet wealth refund income invest market charge payday account bargain deposit expense receipt savings invoice payment fortune cashier pension voucher revenue finance banknote discount interest mortgage currency donation purchase earnings moneybox allowance overdraft insurance inflation statement investment withdrawal accountant shopkeeper millionaire expenditure transaction",
  },
  {
    title: "In the bathroom",
    words: "tap mat tub gel loo bin bath comb soap sink foam plug robe basin brush razor towel steam floss tiles drain cream bidet mirror shower sponge toilet lotion tissue scales shampoo flannel bubbles cabinet perfume plunger cistern washbag bathrobe tweezers lipstick radiator hairbrush hairdryer washbasin deodorant mouthwash nailbrush toothbrush toothpaste aftershave conditioner moisturiser",
  },
  {
    title: "Everyday actions",
    words: "eat run sit nap hug bake cook draw jump play read sing swim talk walk wash work wave wake call chat rest tidy shop plan clean dance drink drive laugh paint sleep smile write study brush climb dream greet stand watch think carry visit learn teach relax answer listen travel cuddle giggle shower stroll wander wonder repair invite finish choose borrow arrive breathe explore imagine whisper whistle stretch prepare collect deliver discuss observe arrange believe exercise practise remember organise daydream complete decorate discover continue celebrate volunteer apologise recognise encourage entertain introduce appreciate understand concentrate participate communicate investigate congratulate",
  },
  {
    title: "Music",
    words: "hum pop rap key bar jig gig band beat duet jazz note rock solo song tune bass alto aria folk hymn tone choir chord opera tempo scale blues pitch lyric stave carol waltz album disco melody rhythm singer ballad chorus octave treble anthem record lyrics sonata quaver reggae encore concert harmony soprano recital quartet karaoke refrain lullaby composer musician symphony serenade ensemble crotchet festival drumbeat vocalist overture baritone orchestra conductor crescendo semibreve performer soundtrack percussion semiquaver composition performance accompanist instrumental",
  },
  {
    title: "Rocks and metals",
    words: "tin ore gem gold iron jade lead onyx opal ruby zinc rock clay coal sand salt lava agate amber chalk flint pearl slate steel topaz stone brass shale beryl ingot metal jewel bronze cobalt copper garnet nickel pebble quartz silver zircon pewter gravel marble pumice silica jasper basalt crystal diamond emerald granite mercury mineral boulder uranium lithium peridot amethyst platinum sapphire titanium obsidian chromium graphite tungsten gemstone aluminium limestone sandstone turquoise moonstone magnesium malachite soapstone aquamarine tourmaline quicksilver",
  },
  {
    title: "Trees and plants",
    words: "ash elm fir ivy oak yew bud sap log bark fern leaf moss palm pine root seed stem twig bush cone herb reed vine weed tree beech birch cedar grass hazel holly maple shrub thorn trunk acorn alder aspen bloom larch rowan plant hedge petal bamboo branch cactus laurel poplar spruce willow nettle privet bonsai walnut pollen bramble cypress heather sapling sequoia thistle conifer foliage redwood blossom chestnut hawthorn sycamore seedling mangrove clematis evergreen mistletoe deciduous toadstool eucalyptus blackthorn undergrowth honeysuckle",
  },
  {
    title: "At the supermarket",
    words: "bag tin jar tub box ham tea jam milk eggs rice soap meat fish till sale list loaf pack beef salt tuna aisle bread fruit pasta sugar flour queue label price offer shelf juice honey basket butter cereal cheese crisps frozen bakery coupon carton bottle packet pickle sweets trolley cashier receipt yoghurt sausage freezer shopper bargain produce counter noodles ketchup barcode checkout discount customer shopping biscuits sandwich groceries vegetable marmalade detergent margarine wholemeal toiletries mayonnaise fishmonger greengrocer delicatessen",
  },
  {
    title: "In the sky",
    words: "sun jet sky air ray bat bird kite moon star bolt wing glow haze dawn dusk soar rain snow wind cloud plane storm comet eagle drone flock light glide smoke rocket meteor planet glider breeze sunset zenith flight aurora rainbow thunder sunrise airship balloon eclipse seagull swallow sunbeam skyline horizon aircraft sunlight moonbeam twilight sunshine aeroplane lightning parachute fireworks satellite moonlight starlight snowflake helicopter atmosphere paraglider thunderbolt stratosphere thundercloud",
  },
  {
    title: "Pets",
    words: "cat dog pup vet toy paw fur bird bowl cage fish food lead tail pony purr bark claw coat tank walk bunny hutch kitty mouse puppy treat brush fetch snake perch groom gecko collar gerbil kennel kitten lizard parrot rabbit canary ferret budgie basket litter hamster terrier spaniel bulldog biscuit walkies aquarium goldfish tortoise whiskers sheepdog grooming cockatiel dachshund greyhound companion chinchilla budgerigar",
  },
  {
    title: "Arts and crafts",
    words: "art pen ink clay glue draw knit tape wool bead card foil felt lace silk yarn brush chalk easel paint paper craft frame model print ruler stamp paste glaze canvas crayon pencil sketch fabric needle pastel ribbon thread mosaic design sewing tissue button collage drawing glitter pottery crochet stencil palette picture origami carving weaving gallery sticker varnish knitting painting portrait scissors charcoal ceramics woodwork sculpture cardboard landscape patchwork sketchbook embroidery paintbrush exhibition decoration handicraft needlework watercolour calligraphy masterpiece illustration",
  },
  {
    title: "Science",
    words: "lab gas ray atom cell data mass acid heat lens test volt wave germ fact gene tube force light laser orbit solid sound fluid graph metal probe prism virus flask energy liquid magnet matter theory fossil method result oxygen carbon motion proton system vacuum beaker neuron enzyme biology circuit element gravity physics density formula nucleus neutron battery current ecology geology molecule electron hydrogen friction pressure research nitrogen particle organism velocity bacteria genetics chemistry discovery scientist evolution telescope magnetism radiation astronomy invention substance experiment laboratory microscope hypothesis technology atmosphere electricity temperature observation evaporation condensation biodiversity",
  },
  {
    title: "On holiday",
    words: "map bus sun inn bag sea spa tan trip tour taxi visa port pool camp tent road tram view sand stay boat beach coach hotel plane train ferry guide villa photo relax abroad cruise flight hostel resort ticket camera island museum safari voyage travel picnic airport luggage tourist journey holiday camping caravan seaside getaway arrival passport postcard suitcase souvenir sunshine rucksack landmark terminal adventure departure excursion guidebook itinerary timetable backpacker sunglasses expedition sightseeing destination reservation holidaymaker",
  },
  {
    title: "Birthday party",
    words: "fun toy hat bow box pop age cake card gift wish sing song tune wrap play joke host party feast games guest music dance jelly cheer treat happy icing laugh magic clown prize candle friend invite ribbon sweets banner giggle balloon cupcake present bunting glitter popcorn birthday confetti surprise streamer magician sparkler wrapping laughter lemonade chocolate fireworks celebrate sleepover invitation decoration celebration candlelight refreshments",
  },
];
