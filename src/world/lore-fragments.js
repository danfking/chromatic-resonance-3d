// lore-fragments.js - FNQ environmental lore text pools
// Each element has fragments categorized by progression tier: early, mid, late

import { ELEMENT_TYPES } from '../creatures/particle-life-creature.js';

export const LORE_FRAGMENTS = {
    [ELEMENT_TYPES.FIRE]: [
        { title: 'Reactor Log #001', text: 'Initial particle acceleration exceeded projections by 340%. Dr. Mansen called it "a beautiful anomaly." That was the last entry before the breach.', tier: 'early' },
        { title: 'Red Dust', text: 'The iron-rich soil of the Tablelands glows faintly at night now. The locals blame the mine. CSIRO knows better.', tier: 'early' },
        { title: 'Containment Protocol', text: 'Heat signatures inside Chamber 7 climbed past 2,000 degrees. The particle matrix had become self-sustaining. Nobody ordered the shutdown in time.', tier: 'early' },
        { title: 'The Ignition', text: 'When the containment field collapsed, the energy release fused the floor into glass. They found Dr. Holloway\'s badge melted into the wall.', tier: 'mid' },
        { title: 'Thermal Bloom', text: 'Satellite imagery shows a persistent heat anomaly over the facility. Official explanation: bushfire scar. Actual temperature: 900 degrees and climbing.', tier: 'mid' },
        { title: 'Ember Country', text: 'The sugarcane fields north of Innisfail burned for three days. The fire moved against the wind. The ADF cordoned the area and blamed arson.', tier: 'mid' },
        { title: 'Meltdown Testimony', text: 'I saw the reactor core through the blast door window. It wasn\'t melting down. It was... assembling something. Something that looked back at me.', tier: 'late' },
        { title: 'The Crucible', text: 'Deep in the wrecked facility, the air itself burns. The particle field has turned this place into a furnace that feeds on its own heat.', tier: 'late' },
    ],
    [ELEMENT_TYPES.WATER]: [
        { title: 'Monsoon Season', text: 'The wet season hit early this year. Three metres of rain in a week. The floodwater that drained from the facility site glowed faintly blue.', tier: 'early' },
        { title: 'Johnstone River', text: 'Fishermen on the Johnstone pulled up barramundi with crystalline growths along their scales. CSIRO bought the entire catch. No explanation given.', tier: 'early' },
        { title: 'Mangrove Report', text: 'The mangroves near the estuary are growing at ten times their normal rate. Root structures show geometric patterns that don\'t occur in nature.', tier: 'early' },
        { title: 'Tidal Readings', text: 'The tide patterns off Mission Beach have shifted. Something deep in the reef is pulling water in rhythmic pulses, like breathing.', tier: 'mid' },
        { title: 'Coral Anomaly', text: 'Reef survey team found new coral formations growing in perfect hexagonal lattices. The polyps emit light on a frequency that matches the reactor output.', tier: 'mid' },
        { title: 'Flood Basement', text: 'Sub-level 3 flooded during the cyclone. When they pumped it out, the water had rearranged the debris into neat geometric stacks. Security footage shows nothing.', tier: 'mid' },
        { title: 'The Drowning Lab', text: 'Lab C is permanently flooded now. The water doesn\'t drain. It doesn\'t evaporate. It just sits there, perfectly still, reflecting a ceiling that isn\'t there.', tier: 'late' },
        { title: 'Deep Current', text: 'Something vast moves through the aquifer beneath the facility. The bore water comes up warm and tasting of ozone. The pumps run backwards at night.', tier: 'late' },
    ],
    [ELEMENT_TYPES.EARTH]: [
        { title: 'Limestone Memory', text: 'The Chillagoe caves have been here for 400 million years. The new formations appeared overnight. They hum when you touch them.', tier: 'early' },
        { title: 'Tin Rush Ghosts', text: 'The old tin mines at Herberton have started collapsing inward. Not caving in — collapsing inward, as if something underground is pulling them down.', tier: 'early' },
        { title: 'Volcanic Soil', text: 'The basalt soil of the Atherton Tablelands is among the richest on Earth. Since the breach, crops planted in it grow in spirals.', tier: 'early' },
        { title: 'Karst Geology', text: 'Underground surveys show new cave systems forming beneath the facility. The limestone is dissolving along perfectly straight lines. No natural process does this.', tier: 'mid' },
        { title: 'Seismic Data', text: 'The tremors don\'t match any tectonic model. They pulse in sequences of prime numbers. The geology department stopped publishing their findings.', tier: 'mid' },
        { title: 'Crystalline Growth', text: 'Quartz deposits near the facility have doubled in size. Cross-sections show internal structures resembling circuit boards. The mineral is warm to the touch.', tier: 'mid' },
        { title: 'Bedrock Shift', text: 'The facility\'s foundation has sunk 1.4 metres. Not settling — sunk. The bedrock beneath it rearranged itself, and the building dropped into the gap.', tier: 'late' },
        { title: 'The Deep Resonance', text: 'At 200 metres below the facility, the drill hit something that rang like a bell. The sound lasted for eleven minutes. The drill bit came up crystallised.', tier: 'late' },
    ],
    [ELEMENT_TYPES.AIR]: [
        { title: 'Cyclone Warning', text: 'Cyclone Maren changed course three times in twelve hours, circling back to the facility each time. BOM called it "unprecedented atmospheric behaviour."', tier: 'early' },
        { title: 'Tablelands Mist', text: 'The morning fog on the Tablelands doesn\'t burn off anymore. It settles into the valleys and stays, thick as cotton wool, humming faintly.', tier: 'early' },
        { title: 'Humidity Spike', text: 'Atmospheric moisture readings near the facility hit 100% and kept climbing. The instruments aren\'t broken. The air is holding more water than physics allows.', tier: 'early' },
        { title: 'Dust Devils', text: 'The dry season brought dust devils that moved in formation. Twelve of them, perfect spacing, circling the facility perimeter for six hours.', tier: 'mid' },
        { title: 'Radio Silence', text: 'All radio frequencies within 30km of the facility carry a low hum. It sounds like breathing. Air traffic control rerouted flights without explanation.', tier: 'mid' },
        { title: 'Pressure Drop', text: 'Barometric pressure inside the facility fluctuates wildly. Staff reported feeling weightless for seconds at a time. Two researchers refused to re-enter.', tier: 'mid' },
        { title: 'The Whisper Layer', text: 'At 3,000 feet above the facility, pilots report hearing voices on dead frequencies. The words are in no known language but feel desperately urgent.', tier: 'late' },
        { title: 'Eye of the Storm', text: 'Satellite imagery shows a permanent low-pressure cell over the facility. Inside it, the air is perfectly still. Nothing moves. Nothing decays.', tier: 'late' },
    ],
    [ELEMENT_TYPES.SHADOW]: [
        { title: 'Surveillance Log', text: 'Camera 14-B captured movement in the sealed wing at 0347. Enhancement shows a human silhouette made of static. ADF flagged the footage as classified.', tier: 'early' },
        { title: 'Kill Order ECHO-9', text: 'Partial intercept: "...all anomalous biological material is to be neutralised on sight. Collateral parameters: acceptable up to Grade 3. Signed, Brig. Carstairs."', tier: 'early' },
        { title: 'Classified Briefing', text: 'The document was almost entirely redacted. The visible words read: "particle" "sentient" "immediate" "threat level ONYX" and "deny everything."', tier: 'early' },
        { title: 'Radio Intercept', text: 'ADF tactical channel, 0215 hours: "Contact north of the river. It\'s not on thermals but we can hear it. Requesting permission to engage. Over."', tier: 'mid' },
        { title: 'Drone Footage', text: 'The reconnaissance drone captured 40 minutes of the facility exterior. Frame-by-frame analysis shows shadows moving independently of their sources.', tier: 'mid' },
        { title: 'The Blackout', text: 'Power failed across Innisfail for nine hours. The facility\'s backup generators were running — powering equipment that had been decommissioned six months prior.', tier: 'mid' },
        { title: 'Containment Failure Report', text: 'Subject BLOOM-7 breached perimeter at 0412. Tracking lost in rainforest canopy. Thermal, UV, and radar negative. It doesn\'t show up on anything anymore.', tier: 'late' },
        { title: 'Final Transmission', text: 'Last signal from Outpost Theta: "It\'s not hostile. It\'s not friendly. It\'s not anything we have a word for. Pull everyone back. Pull everyone—" [signal lost]', tier: 'late' },
    ],
    [ELEMENT_TYPES.LIGHT]: [
        { title: 'Lab Journal, Day 1', text: 'The particle matrix responded to stimuli today. Not just reacted — responded. It oriented toward the light source and held position. Dr. Yuen cried.', tier: 'early' },
        { title: 'The Awakening', text: 'It started as a faint glow in the containment vessel. Then the glow moved. Then it pressed against the glass. Then it looked at us.', tier: 'early' },
        { title: 'CSIRO Internal Memo', text: 'We are not dealing with a chemical reaction or an electrical phenomenon. The particle field exhibits preference, memory, and what I can only call curiosity.', tier: 'early' },
        { title: 'Bioluminescence', text: 'The rainforest canopy near the facility glows at night now. Not from fungi — from the leaves themselves. They pulse in time with the reactor\'s old frequency.', tier: 'mid' },
        { title: 'Dr. Yuen\'s Last Paper', text: 'If the Bloom is what I think it is, then we haven\'t created something new. We\'ve woken something that was always here, sleeping in the quantum foam.', tier: 'mid' },
        { title: 'The Spectrum Shift', text: 'Light behaves differently near the facility. Prisms produce colours that shouldn\'t exist. The new frequencies are visible to some people and not others.', tier: 'mid' },
        { title: 'First Contact Protocol', text: 'It communicated today. Not in words. In light patterns. We showed it the periodic table and it rearranged the elements into something more elegant.', tier: 'late' },
        { title: 'Hope in the Canopy', text: 'The particle field isn\'t spreading destruction. It\'s spreading possibility. The reef is healing. The forest is growing. We just have to survive long enough to see it.', tier: 'late' },
    ],
};

/**
 * Get a random lore fragment for an element
 * @param {number} element - ELEMENT_TYPES value
 * @param {number|null} seed - Optional seed for deterministic selection
 * @returns {object|null} {title, text, tier}
 */
export function getRandomLore(element, seed = null) {
    const pool = LORE_FRAGMENTS[element];
    if (!pool || pool.length === 0) return null;
    const index = seed !== null
        ? Math.abs(seed) % pool.length
        : Math.floor(Math.random() * pool.length);
    return pool[index];
}

/**
 * Get lore appropriate to the player's progression through the level
 * @param {number} element - ELEMENT_TYPES value
 * @param {number} distanceFromEntrance - BFS distance from entrance
 * @param {number} maxDistance - Maximum distance in the level
 * @returns {object|null} {title, text, tier}
 */
export function getLoreByDistance(element, distanceFromEntrance, maxDistance) {
    const pool = LORE_FRAGMENTS[element];
    if (!pool || pool.length === 0) return null;

    // Determine progression tier based on distance ratio
    const ratio = maxDistance > 0 ? distanceFromEntrance / maxDistance : 0;
    let tier;
    if (ratio < 0.33) {
        tier = 'early';
    } else if (ratio < 0.67) {
        tier = 'mid';
    } else {
        tier = 'late';
    }

    const tiered = pool.filter(f => f.tier === tier);
    if (tiered.length === 0) return pool[Math.floor(Math.random() * pool.length)];
    return tiered[Math.floor(Math.random() * tiered.length)];
}
