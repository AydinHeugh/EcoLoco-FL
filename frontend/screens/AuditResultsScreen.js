import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, useWindowDimensions, Linking, TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { getPlan, getNearby, generateLetter, userMessage } from '../services/geminiService';
import { COLORS, STATUS_COLORS, FONTS, FONT_ASSETS, TYPE, LINE } from '../theme';
import StatusBadge from '../components/StatusBadge';
import PercentRing from '../components/PercentRing';
import CountUp, { useCountUp } from '../components/CountUp';
import PlantPhoto, { PhotoCredit } from '../components/PlantPhoto';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BAR_MS, COUNT_STAGGER, useDelayedFlag } from '../motion';
import PlanCard, { NOT_CHECKED_HERE } from '../components/PlanCard';
import SiteFilters, { ANY_SITE } from '../components/SiteFilters';
import SourceLine from '../components/SourceLine';
import StatusBars from '../components/StatusBars';
import ScreenHeader from '../components/ScreenHeader';
import ScanningLeaf from '../components/ScanningLeaf';
import Reveal, { RevealProvider, useRevealScroll, useInView } from '../components/Reveal';
import { PHOTOS } from '../photos';
import CaterpillarBars from '../components/CaterpillarBars';
import OfflineNotice, { reportAi } from '../components/OfflineNotice';
import { forgetScannedPlant } from './AuditScreen';

const NURSERY_URL = 'https://plantrealflorida.org';
const NO_DATA = "We don't have wildlife info for this plant yet";

const BUCKETS = [
  { key: 'native',     status: 'native',     label: 'Native' },
  { key: 'non_native', status: 'non-native', label: 'Non-native (not invasive)' },
  { key: 'invasive',   status: 'invasive',   label: 'Invasive (hurting wildlife)' },
  { key: 'unknown',    status: 'unknown',    label: 'Unknown: not on Florida lists' },
];

const NEARBY_WHY = 'Natives that are common here clearly grow well in your area, so they are good choices to plant. An invasive plant on this list could spread onto your campus, so look out for it.';
const WHY_NOTE = 'The reasons behind your plan, each with its source. Use them to back up your letter.';
const STATUS_ICONS = { native: 'leaf', 'non-native': 'earth', invasive: 'alert-octagon-outline', unknown: 'help-circle-outline' };

function NearbyRow({ plant, max, order }) {
  const ref = useRef(null);
  const shown = useCountUp(plant.count, useInView(ref), order * COUNT_STAGGER, BAR_MS);
  return (
    <View ref={ref} collapsable={false} style={styles.plantRow}>
      <View style={styles.photoRow}>
        <PlantPhoto photo={plant.photo} size={56} radius={12} label={plant.plant_name} />
        <View style={styles.photoRowBody}>
          <View style={styles.plantHead}>
            <Text style={styles.plantName}>{plant.plant_name}</Text>
            <StatusBadge status={plant.status} label={plant.status_label} />
          </View>
          <View style={styles.seenTrack}>
            <View style={[styles.seenBar, { width: `${(shown / max) * 100}%`, backgroundColor: STATUS_COLORS[plant.status].color }]} />
          </View>
          <Text style={styles.plantWhy} accessibilityLabel={`Seen ${plant.count} ${plant.count === 1 ? 'time' : 'times'} nearby`}>
            Seen {shown} {plant.count === 1 ? 'time' : 'times'} nearby
          </Text>
          <PhotoCredit photo={plant.photo} />
        </View>
      </View>
    </View>
  );
}

function LetterGenerator({ plan, zipCode }) {
  const compact = useWindowDimensions().width < 360;
  const [loading, setLoading] = useState(false);
  const [letter,  setLetter]  = useState('');
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateLetter(plan, zipCode);
      setLetter(data.result);
      reportAi(data.ai_unavailable);
    } catch (err) {
      setError(userMessage(err, 'Could not write the letter. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.section, compact && styles.sectionCompact]}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Letter to your principal</Text>
      <Text style={styles.sectionNote}>A draft from your plan. Change anything, or don't use it at all.</Text>
      <TouchableOpacity accessibilityRole="button" style={[styles.btn, loading && styles.btnDisabled]} onPress={handleGenerate} disabled={loading}>
        {loading ? <ActivityIndicator color={COLORS.cream} size="small" /> : <Text style={styles.btnText}>Write the letter</Text>}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {letter ? (
        <View style={[styles.letterCard, compact && styles.letterCardCompact]}>
          <Text style={styles.sectionNote}>Tap to edit. Fill in the parts in [brackets].</Text>
          <TextInput accessibilityLabel="Edit your letter to the principal" multiline scrollEnabled={false} value={letter} onChangeText={setLetter}
            style={[styles.letterInput, compact && styles.letterInputCompact]} textAlignVertical="top" />
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.btnOutline}
            onPress={async () => {
              await Clipboard.setStringAsync(letter);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Text style={styles.btnOutlineText}>{copied ? 'Copied!' : 'Copy Letter'}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionNote}>Read it over and change anything before you send it.</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function AuditResultsScreen(props) {
  return <RevealProvider><AuditResults {...props} /></RevealProvider>;
}

function AuditResults({ route, navigation }) {
  const onScroll = useRevealScroll();
  const { plants = [], zipCode, lat, lon } = route.params ?? {};
  const [request,  setRequest]  = useState({ plants, skip: [], site: ANY_SITE, showAll: false, extras: [] });
  const [plan,     setPlan]     = useState(null);
  const [planFor,  setPlanFor]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [nearby,   setNearby]   = useState([]);
  const [attempt,  setAttempt]  = useState(0);

  const { width } = useWindowDimensions();
  const maxWidth = Math.min(width, 760);
  const compact = width < 360;
  const gutter = compact ? 16 : 20;
  const ringSize = Math.max(100, Math.min(148, Math.floor((maxWidth - gutter * 2 - 74) / 2)));
  const countColumns = maxWidth >= 640 ? 4 : 2;
  const countWidth = (maxWidth - gutter * 2 - (countColumns - 1) * 12) / countColumns;
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const stale = plan != null && planFor !== request;
  const slow = useDelayedFlag(stale);

  useEffect(() => {
    let current = true;
    setError(null);
    getPlan(request.plants.map(p => ({ scientific_name: p.scientific_name, plant_name: p.plant_name })), zipCode, request.skip, request.site, request.showAll, request.extras)
      .then(data => { if (current) { setPlan(data.result); setPlanFor(request); } })
      .catch(err => { if (current) setError(userMessage(err, 'Could not check your plants. Check your connection and try again.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [request, attempt]);

  useEffect(() => {
    if (lat != null && lon != null) {
      getNearby(lat, lon).then(data => setNearby(data.result)).catch(() => setNearby([]));
    }
  }, []);

  function removePlant(index) {
    forgetScannedPlant(planFor.plants[index]._id);
    setRequest({ ...planFor, plants: planFor.plants.filter((_, i) => i !== index) });
  }

  function toggleLetter(name, extra) {
    if (extra) {
      const extras = planFor.extras.includes(name) ? planFor.extras.filter(n => n !== name) : [...planFor.extras, name];
      setRequest({ ...planFor, extras });
      return;
    }
    const skip = planFor.skip.includes(name) ? planFor.skip.filter(n => n !== name) : [...planFor.skip, name];
    setRequest({ ...planFor, skip });
  }

  if (!fontsLoaded) return <View style={styles.container} />;

  const summary = plan?.summary;
  const addName = name => plan?.add.find(a => a.scientific_name === name)?.common_name;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll} scrollEventThrottle={64}>
      <View style={[styles.inner, { width: maxWidth }]}>

        <ScreenHeader
          photo={PHOTOS.results}
          photoLabel="A school garden full of native plants"
          title="Your plan"
          right={(
            <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.backBtn}>← Back to EcoScan</Text>
            </TouchableOpacity>
          )}
        />
        <OfflineNotice />

        {loading && (
          <View style={styles.centerSection}>
            <ScanningLeaf size={64} />
            <Text style={styles.mutedText}>Checking your plants against Florida lists…</Text>
          </View>
        )}

        {!loading && error && !plan && (
          <View style={styles.centerSection}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
              <Text style={styles.btnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && plan && (
          <>
            <View style={[styles.section, compact && styles.sectionCompact]}>
              {slow && !error && <Text style={styles.mutedText}>Updating your plan…</Text>}
              {stale && error && (
                <>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.btnOutline} onPress={() => setAttempt(a => a + 1)}>
                    <Text style={styles.btnOutlineText}>Try again</Text>
                  </TouchableOpacity>
                </>
              )}
              {plan.remove.length > 0 && (
                <View style={styles.sectionIntro}>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>Make room for natives</Text>
                </View>
              )}
              {plan.remove.map((card, i) => (
                <Reveal key={card.scientific_name} index={i}>
                  <PlanCard card={card} kind="remove"
                    replacementName={addName(card.replacement)} plantingsChecked={plan.plantings_checked !== false} />
                </Reveal>
              ))}
              {plan.plantings_checked === false
                ? <Text style={styles.mutedText}>{NOT_CHECKED_HERE}</Text>
                : (
                  <>
                    <View style={styles.sectionIntro}>
                      <Text accessibilityRole="header" style={styles.sectionTitle}>Choose native additions</Text>
                    </View>
                    <SiteFilters site={request.site} hidden={plan.hidden_by_site ?? 0} disabled={slow}
                      onChange={site => setRequest({ ...planFor, site })} />
                    {plan.add.length === 0
                      ? <Text style={styles.mutedText}>{plan.hidden_by_site > 0 ? 'No checked plants fit all of those choices. Try setting one back to Not sure.' : 'No plants are ready to recommend yet. Our team is still checking each one.'}</Text>
                      : (
                        <>
                          <Text style={styles.sectionNote}>Untick a plant to leave it out of your letter and the "with the plan" numbers.</Text>
                          {plan.add.map((card, i) => (
                            <Reveal key={card.scientific_name} index={i}>
                              <PlanCard card={card} kind="add"
                                inLetter={card.in_letter !== false} onToggleLetter={stale ? null : () => toggleLetter(card.scientific_name, card.extra)} />
                            </Reveal>
                          ))}
                          {(plan.more_available > 0 || request.showAll) && (
                            <>
                              {request.showAll && <Text style={styles.sectionNote}>The extra plants start outside your letter. Tick one to add it.</Text>}
                              <TouchableOpacity style={styles.btnOutline} disabled={stale}
                                onPress={() => setRequest({ ...planFor, showAll: !planFor.showAll, extras: [] })}>
                                <Text style={styles.btnOutlineText}>
                                  {request.showAll ? 'Show fewer plants' : `Show all plants that fit (${plan.more_available} more)`}
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      )}
                  </>
                )}
              <TouchableOpacity onPress={() => Linking.openURL(NURSERY_URL)}>
                <Text style={styles.link}>Find a native plant nursery near you (plantrealflorida.org) →</Text>
              </TouchableOpacity>
            </View>


            <View style={[styles.section, compact && styles.sectionCompact]}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>What your campus supports now</Text>
              <Text style={styles.sectionNote}>Scanned something by mistake, like a fake or potted plant? Remove it and your counts and plan update.</Text>
              {summary.plants.length === 0 && <Text style={styles.mutedText}>No plants left. Go back to EcoScan to scan more.</Text>}
              {summary.plants.map((p, i) => (
                <Reveal key={planFor.plants[i]?._id ?? i} index={i} style={styles.plantRow}>
                  <View style={styles.photoRow}>
                    <PlantPhoto photo={p.photo} size={56} radius={12} label={p.plant_name} />
                    <View style={styles.photoRowBody}>
                      <View style={styles.plantHead}>
                        <Text style={styles.plantName}>{p.plant_name}</Text>
                        <View style={styles.plantActions}>
                          <StatusBadge status={p.status} label={p.status_label} />
                          <TouchableOpacity
                            onPress={() => removePlant(i)}
                            disabled={stale}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${p.plant_name}`}
                            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                          >
                            <Text style={[styles.removeBtn, stale && styles.btnDisabled]}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.plantWhy}>{p.why || NO_DATA}</Text>
                      {p.why ? <SourceLine source={{ name: p.source_label }} /> : null}
                      <PhotoCredit photo={p.photo} />
                    </View>
                  </View>
                </Reveal>
              ))}
            </View>


            <View style={[styles.ringBand, compact && styles.ringBandCompact]}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, styles.metricTitle]}>How native is your campus?</Text>
              {summary.percent_native === null
                ? <Text style={styles.mutedText}>Not enough identified plants yet</Text>
                : (
                  <>
                    <View style={styles.rings}>
                      <PercentRing size={ringSize} title="Kinds of plants" caption="kinds native"
                        now={summary.percent_native_kinds} withPlan={summary.percent_native_kinds_with_plan} />
                      <PercentRing size={ringSize} title="Every plant" caption="plants native" delay={COUNT_STAGGER}
                        now={summary.percent_native} withPlan={summary.percent_native_with_plan} />
                    </View>
                    <Text style={[styles.mutedText, styles.ringNote]}>
                      Kinds of plants counts each species once, however many you scanned. Every plant counts each one you scanned.
                    </Text>
                  </>
                )}
            </View>

            <View style={[styles.ringSection, compact && styles.sectionCompact]}>
              <View style={styles.countRow}>
                {BUCKETS.map(({ key, status, label }, i) => (
                  <View key={key} style={[styles.countItem, { width: countWidth }]}>
                    <View style={[styles.countIcon, { backgroundColor: STATUS_COLORS[status].bg }]}>
                      <MaterialCommunityIcons name={STATUS_ICONS[status]} size={22} color={STATUS_COLORS[status].color} />
                    </View>
                    <CountUp value={summary.counts[key]} style={[styles.countNum, { color: STATUS_COLORS[status].color }]} delay={i * COUNT_STAGGER} />
                    <Text style={styles.countLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              {summary.counts.unknown > 0 && (
                <Text style={styles.mutedText}>Unknown plants are not counted in the percentage.</Text>
              )}
              {summary.known > 0 && <StatusBars now={summary.counts} withPlan={summary.counts_with_plan} />}
              <CaterpillarBars items={[
                ...plan.add.filter(c => c.nwf).map(c => ({ name: c.common_name, kind: 'add', ...c.nwf, count: c.nwf.caterpillar_species })),
                ...plan.remove.filter(c => c.nwf).map(c => ({ name: c.plant_name, kind: 'remove', ...c.nwf, count: c.nwf.caterpillar_species })),
              ]} />
            </View>


            {nearby.length > 0 && (
              <>
                <View style={[styles.section, compact && styles.sectionCompact]}>
                  <Text style={styles.sectionTitle}>Seen near you</Text>
                  <Text style={styles.sectionNote}>Plants people photographed within about 5 km of your school, checked by other iNaturalist users.</Text>
                  <Text style={styles.sectionNote}>{NEARBY_WHY}</Text>
                  {nearby.map((p, i) => (
                    <NearbyRow key={i} plant={p} order={i} max={Math.max(...nearby.map(n => n.count), 1)} />
                  ))}
                  <SourceLine source={{ name: 'iNaturalist', url: 'https://www.inaturalist.org' }} />
                </View>
              </>
            )}

            <View style={[styles.section, compact && styles.sectionCompact]}>
              <Text style={styles.sectionTitle}>Why this matters</Text>
              <Text style={styles.sectionNote}>{WHY_NOTE}</Text>
              {plan.why_this_matters.map((line, i) => (
                <Reveal key={i} index={i} style={styles.whyLine}>
                  <View style={styles.whyIcon}>
                    <MaterialCommunityIcons name={line.icon ?? 'leaf'} size={22} color={COLORS.softGreen} />
                  </View>
                  <View style={styles.photoRowBody}>
                    <Text style={styles.plantWhy}>{line.text}</Text>
                    <SourceLine source={line.source} />
                  </View>
                </Reveal>
              ))}
            </View>


            <LetterGenerator key={planFor.plants.map(p => p._id).join(',') + '|' + planFor.skip.join(',')} plan={plan} zipCode={zipCode} />

            <View style={[styles.ctaSection, compact && styles.sectionCompact]}>
              <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.goBack()}>
                <Text style={styles.btnOutlineText}>Scan More Plants</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </View>
    </ScrollView>
  );
}

const SOFT = { shadowColor: COLORS.shadow, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 };

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { alignItems: 'center' },
  inner:         { alignSelf: 'center', width: '100%' },

  backBtn:  { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, paddingVertical: 12 },


  centerSection: { alignItems: 'center', paddingVertical: 60, gap: 14, paddingHorizontal: 24 },
  section:       { paddingHorizontal: 20, paddingVertical: 30, gap: 12 },
  sectionCompact: { paddingHorizontal: 16 },
  sectionIntro:  { gap: 6, paddingTop: 4, paddingBottom: 8 },
  ringBand:      { alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: 28, ...SOFT, marginHorizontal: 20, marginTop: 28, paddingHorizontal: 16, paddingVertical: 28, gap: 18 },
  ringBandCompact: { marginHorizontal: 16 },
  metricTitle:   { fontSize: TYPE.h2, lineHeight: LINE.h2, textAlign: 'center' },
  rings:         { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8, rowGap: 24, width: '100%' },
  ringNote:      { maxWidth: 480, fontSize: TYPE.caption, lineHeight: LINE.caption },
  ringSection:   { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 26, gap: 18 },

  sectionTitle: { fontSize: TYPE.h2, lineHeight: LINE.h2, fontFamily: FONTS.heading, color: COLORS.darkGreen },
  sectionNote:  { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: LINE.body },
  mutedText:    { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },
  errorText:    { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.body, color: COLORS.error, textAlign: 'center' },
  link:         { fontSize: TYPE.link, fontFamily: FONTS.bodyBold, color: COLORS.softGreen, textAlign: 'center', paddingVertical: 14, textDecorationLine: 'underline' },

  plantRow:  { padding: 16, borderRadius: 20, backgroundColor: COLORS.cardBg, ...SOFT, gap: 6 },
  plantHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  plantName: { fontSize: TYPE.lead, lineHeight: LINE.lead, fontFamily: FONTS.heading, color: COLORS.darkGreen, flexShrink: 1 },
  plantActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  removeBtn: { fontSize: TYPE.caption, fontFamily: FONTS.bodyBold, color: COLORS.terracotta, textDecorationLine: 'underline', paddingVertical: 12 },
  whyLine:   { paddingVertical: 10, flexDirection: 'row', gap: 14 },
  whyIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.lightBg, alignItems: 'center', justifyContent: 'center' },
  photoRow:  { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  photoRowBody: { flex: 1, minWidth: 0, gap: 6 },
  seenTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.lightBg, overflow: 'hidden' },
  seenBar:   { height: 8, borderRadius: 4 },
  countIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  plantWhy:  { fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody, lineHeight: LINE.body },

  countRow:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, width: '100%' },
  countItem:  { alignItems: 'center', gap: 5, padding: 16, backgroundColor: COLORS.cardBg, borderRadius: 20, ...SOFT },
  countNum:   { fontSize: TYPE.h2, fontFamily: FONTS.headingBlack },
  countLabel: { fontSize: TYPE.caption, lineHeight: LINE.caption, fontFamily: FONTS.body, color: COLORS.textMuted, textAlign: 'center' },

  btn:            { backgroundColor: COLORS.darkGreen, borderRadius: 14, paddingVertical: 17, paddingHorizontal: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled:    { opacity: 0.45 },
  btnText:        { fontSize: TYPE.body, fontFamily: FONTS.bodyBold, color: COLORS.white },
  btnOutline:     { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardBg, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', marginTop: 12 },
  btnOutlineText: { fontSize: TYPE.body, lineHeight: LINE.body, fontFamily: FONTS.bodyBold, color: COLORS.darkGreen, textAlign: 'center' },

  letterCard: {
    marginTop: 12, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 18, gap: 14,
  },
  letterCardCompact: { padding: 12 },
  letterInput: {
    fontSize: TYPE.body, fontFamily: FONTS.body, color: COLORS.textBody,
    lineHeight: LINE.body, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16, minHeight: 520,
  },
  letterInputCompact: { padding: 12 },

  ctaSection: { padding: 24, paddingBottom: 52 },
});
