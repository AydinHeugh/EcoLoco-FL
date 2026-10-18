import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, ActivityIndicator } from 'react-native';
import { isLoaded } from 'expo-font';
import { candidateMatchText, confirmationCandidates, evidenceText, identificationNeedsConfirmation, identificationProvider, plantExtraFacts, safeEvidenceUrl, suggestedCandidateName, taxonomyStatus, verifiedAtlasUrl } from '../utils/plantEvidence';

const PLANTNET_LOGO = require('../../assets/powered-by-plantnet-light.png');

export function EvidenceLink({ url, children }) {
  const [error, setError] = useState(false);
  const safeUrl = safeEvidenceUrl(url);
  if (!safeUrl) return null;
  return <View>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel={typeof children === 'string' ? children : 'Read evidence source'} onPress={() => { setError(false); Linking.openURL(safeUrl).catch(() => setError(true)); }} style={styles.linkButton}>
      <Text style={[styles.link, isLoaded('DMSans_400Regular') && styles.bodyFont]}>{children || 'Read source'} ↗</Text>
    </TouchableOpacity>
    {error && <Text accessibilityLiveRegion="polite" style={styles.small}>Couldn’t open this link.</Text>}
  </View>;
}

export function PlantFacts({ plant = {} }) {
  const rows = plantExtraFacts(plant);
  const atlas = verifiedAtlasUrl(plant);
  if (!rows.length && !atlas) return null;
  return <View style={styles.detailGroup}>
    {rows.map((row, index) => <View key={`${row.title}-${index}`} style={styles.detailGroup}>
      <Text style={[styles.detailTitle, isLoaded('DMSans_700Bold') && styles.boldFont]}>{row.title}</Text>
      <Text style={[styles.small, isLoaded('DMSans_400Regular') && styles.bodyFont]}>{row.text}</Text>
      <EvidenceLink url={row.source_url}>{row.source_name || 'Read source'}</EvidenceLink>
    </View>)}
    <EvidenceLink url={atlas}>Florida Plant Atlas</EvidenceLink>
  </View>;
}

export default function PlantEvidence({ plant = {}, onConfirm, onRetake, confirming = false, compact = false, children }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(!compact);
  plant = plant && typeof plant === 'object' && !Array.isArray(plant) ? plant : {};
  const text = (field) => evidenceText(plant[field]);
  const status = taxonomyStatus(plant);
  const needsReview = identificationNeedsConfirmation(plant);
  const unidentified = plant.state === 'unidentified';
  const canConfirm = typeof onConfirm === 'function';
  const canRetake = typeof onRetake === 'function';
  const provider = plant.id_source;
  const candidates = confirmationCandidates(plant).filter((candidate) => !plant.needs_taxon_confirmation || candidate.scientific_name !== plant.scientific_name);
  const suggestedName = suggestedCandidateName(plant);
  const supportEvidence = text('wildlife_support_reason') || (plant.wildlife_support_verified ? text('why') : '') || (safeEvidenceUrl(plant.helps?.source?.url) ? evidenceText(plant.helps?.text) : '');
  const actions = (Array.isArray(plant.actions) ? plant.actions : []).filter((item) => item && evidenceText(item.action));
  const summary = supportEvidence || (!needsReview && evidenceText(actions[0]?.action));
  const zones = text('fisc_zones');
  const usesPlantNet = provider === 'plantnet' || provider === 'openai_adjudicated';
  const confidence = !plant.user_confirmed && Number.isFinite(plant.confidence) ? `${Math.round(plant.confidence * 100)}% match` : '';
  const providerShort = plant.user_confirmed ? 'Selected by you' : ({ plantnet: 'Pl@ntNet', openai_adjudicated: 'Pl@ntNet + image review', openai_fallback: 'Image review', sample: 'Sample observation', none: 'No match yet' })[provider] || '';
  const bodyFont = isLoaded('DMSans_400Regular') && styles.bodyFont;
  const boldFont = isLoaded('DMSans_700Bold') && styles.boldFont;
  const headingFont = isLoaded('Fraunces_700Bold') && styles.headingFont;
  const colors = { native: '#e3eedb', invasive: '#fbe4d9', nonnative: '#f9edcf', unknown: '#ecece6' };

  return <View style={[styles.card, compact && styles.compact]}>
    <View style={styles.headingRow}>
      <View style={styles.identity}>
        <Text accessibilityRole={compact ? undefined : 'header'} style={[styles.name, headingFont, compact && styles.compactName]}>{text('plant_name') || text('common_name') || 'Unidentified plant'}</Text>
        {!!text('scientific_name') && <Text style={[styles.scientific, bodyFont]}>{text('scientific_name')}</Text>}
      </View>
      <View style={[styles.badge, { backgroundColor: colors[status.tone] }]}>
        <Text style={[styles.badgeText, boldFont]}>{status.label}{needsReview && status.tone !== 'unknown' ? ' · tentative match' : ''}</Text>
      </View>
    </View>
    {!compact && !!(confidence || providerShort) && <Text style={[styles.small, bodyFont]}>{[confidence, providerShort].filter(Boolean).join(' · ')}</Text>}
    {!compact && !expanded && !!summary && <Text style={[styles.body, bodyFont]} numberOfLines={2} ellipsizeMode="tail">{needsReview ? 'If confirmed: ' : ''}{summary}</Text>}

    {unidentified ? <View style={styles.reviewContent}>
      <Text style={[styles.small, bodyFont]}>No clear match. Try a close-up of a leaf or flower.</Text>
      {canRetake && <TouchableOpacity accessibilityRole="button" disabled={confirming} aria-disabled={confirming} accessibilityState={{ disabled: confirming }} onPress={onRetake} style={styles.linkButton}><Text style={[styles.link, bodyFont]}>Try another photo</Text></TouchableOpacity>}
    </View> : needsReview && <View style={styles.review}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Review match" aria-expanded={reviewExpanded} accessibilityState={{ expanded: reviewExpanded }} onPress={() => setReviewExpanded(!reviewExpanded)} style={styles.reviewToggle}>
        <Text style={[styles.reviewTitle, boldFont]}>Review match</Text><Text style={styles.chevron}>{reviewExpanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {reviewExpanded && <View style={styles.reviewContent}>
        <Text style={[styles.small, bodyFont]}>{plant.needs_taxon_confirmation ? 'Catalog alternatives. Check the variety before choosing; leave unresolved if unsure.' : 'Check the distinguishing features before choosing a match.'}</Text>
        {canConfirm && candidates.map((candidate) => <TouchableOpacity key={candidate.scientific_name} accessibilityRole="button" accessibilityLabel={`Confirm ${candidate.scientific_name}`} disabled={confirming} aria-disabled={confirming} accessibilityState={{ disabled: confirming }} onPress={() => onConfirm(candidate.scientific_name)} style={[styles.candidate, confirming && styles.disabled]}>
          <View style={styles.candidateIdentity}>
            <Text style={[styles.candidateName, boldFont]}>{evidenceText(candidate.common_name) || evidenceText(candidate.plant_name) || candidate.scientific_name}</Text>
            {(candidate.common_name || candidate.plant_name) && <Text style={[styles.small, bodyFont]}>{candidate.scientific_name}</Text>}
            {!!candidateMatchText(candidate, provider) && <Text style={[styles.small, bodyFont]}>{candidateMatchText(candidate, provider)}{suggestedName === candidate.scientific_name.trim().toLowerCase() ? ' · Best guess' : ''}</Text>}
          </View>
          <Text style={[styles.choose, boldFont]}>Use match →</Text>
        </TouchableOpacity>)}
        {!candidates.length && <Text style={[styles.small, bodyFont]}>Try another photo or select a known species from the catalog.</Text>}
        {canRetake && <TouchableOpacity accessibilityRole="button" disabled={confirming} aria-disabled={confirming} accessibilityState={{ disabled: confirming }} onPress={onRetake} style={styles.linkButton}><Text style={[styles.link, bodyFont]}>Use another photo</Text></TouchableOpacity>}
        {confirming && <ActivityIndicator accessibilityLabel="Checking selected species" color="#1e3a1e" />}
      </View>}
    </View>}

    <View style={styles.footer}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Details & sources" aria-expanded={expanded} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.detailsToggle}>
        <Text style={[styles.link, bodyFont]}>Details & sources</Text><Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {usesPlantNet && <TouchableOpacity accessibilityRole="link" accessibilityLabel="Plant identification supported by Pl@ntNet" onPress={() => Linking.openURL('https://plantnet.org').catch(() => {})} style={styles.credit}>
        <Image source={PLANTNET_LOGO} style={styles.creditLogo} resizeMode="contain" accessibilityLabel="Powered by Pl@ntNet" />
      </TouchableOpacity>}
    </View>

    {expanded && <View style={styles.details}>
      <View style={styles.detailGroup}>
        <Text style={[styles.detailTitle, boldFont]}>Identification</Text>
        <Text style={[styles.small, bodyFont]}>{plant.user_confirmed ? 'Selected by you' : identificationProvider(provider)}{confidence ? ` · ${confidence}` : ''}</Text>
        <Text style={[styles.small, bodyFont]}>The source verifies the named taxon’s status, not the photo identification.</Text>
        {!!text('taxonomy_notes') && <Text style={[styles.small, bodyFont]}>{text('taxonomy_notes')}</Text>}
      </View>
      <View style={styles.detailGroup}>
        <Text style={[styles.detailTitle, boldFont]}>{status.label}</Text>
        <Text style={[styles.small, bodyFont]}>{text('status_scope') || 'Florida records'}{text('verified_on') ? ` · checked ${text('verified_on')}` : ''}</Text>
        {!!text('source') && <Text style={[styles.small, bodyFont]}>{text('source')}</Text>}
        {!!text('why') && text('why') !== supportEvidence && <Text style={[styles.small, bodyFont]}>{text('why')}</Text>}
        {!!text('fisc_category') && <Text style={[styles.small, bodyFont]}>FISC category {text('fisc_category')}{zones ? ` · zones ${zones}` : ''}</Text>}
        {!!text('distribution_note') && <Text style={[styles.small, bodyFont]}>{text('distribution_note')}</Text>}
        <EvidenceLink url={plant.source_url}>Florida status source</EvidenceLink>
      </View>
      {!!supportEvidence && <View style={styles.detailGroup}>
        <Text style={[styles.detailTitle, boldFont]}>Wildlife relationship</Text>
        <Text style={[styles.body, bodyFont]}>{supportEvidence}</Text>
        <EvidenceLink url={plant.why_source_url || plant.wildlife_source_url || plant.helps?.source?.url}>Relationship source</EvidenceLink>
        <Text style={[styles.small, bodyFont]}>Documented relationships do not measure wildlife at this site.</Text>
      </View>}
      {((text('suggested_status') && text('suggested_status') !== 'unknown') || text('suggested_wildlife_reason')) && <View style={styles.detailGroup}>
        <Text style={[styles.detailTitle, boldFont]}>Unverified suggestion</Text>
        {text('suggested_status') && text('suggested_status') !== 'unknown' && <Text style={[styles.small, bodyFont]}>Possible status: {text('suggested_status')}.</Text>}
        {!!text('suggested_wildlife_reason') && <Text style={[styles.small, bodyFont]}>{text('suggested_wildlife_reason')}</Text>}
        <Text style={[styles.small, bodyFont]}>Excluded from verified totals and planting selections.</Text>
      </View>}
      {actions.length > 0 && !needsReview && <View style={styles.detailGroup}>
        <Text style={[styles.detailTitle, boldFont]}>{actions.length === 1 ? 'Next step' : 'Next steps'}</Text>
        {actions.map((item, index) => <View key={index} style={styles.detailGroup}>
          <Text style={[styles.body, bodyFont]}>{evidenceText(item.action)}</Text>
          {!!evidenceText(item.impact) && <Text style={[styles.small, bodyFont]}>{evidenceText(item.impact)}</Text>}
        </View>)}
      </View>}
      {!!text('management_notes') && <Text style={[styles.small, bodyFont]}>{text('management_notes')}</Text>}
      <PlantFacts plant={plant} />
      {!!text('inat_note') && <Text style={[styles.small, bodyFont]}>Nearby observations: {text('inat_note')}</Text>}
      {plant.ai_unavailable && <Text style={[styles.small, bodyFont]}>Extra explanation is unavailable. Verified plant records are retained.</Text>}
      <Text style={[styles.small, bodyFont]}>Florida status does not establish suitability for every planting site.</Text>
      {children}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fffdf8', padding: 22, borderRadius: 16, borderWidth: 1, borderColor: '#d4cfc4', gap: 12 },
  compact: { backgroundColor: 'transparent', padding: 0, borderWidth: 0, gap: 9 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  identity: { flexGrow: 1, flexShrink: 1, gap: 4 },
  name: { fontSize: 25, lineHeight: 31, fontWeight: '700', color: '#1e3a1e' },
  compactName: { fontSize: 20, lineHeight: 26 },
  scientific: { fontSize: 13, fontStyle: 'italic', color: '#646454', lineHeight: 20 },
  body: { fontSize: 14, lineHeight: 22, color: '#4a4a3a' },
  small: { fontSize: 12, lineHeight: 19, color: '#646454' },
  bodyFont: { fontFamily: 'DMSans_400Regular' },
  boldFont: { fontFamily: 'DMSans_700Bold' },
  headingFont: { fontFamily: 'Fraunces_700Bold' },
  badge: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start', maxWidth: '100%' },
  badgeText: { color: '#1e3a1e', fontWeight: '600', fontSize: 11, lineHeight: 17 },
  link: { fontSize: 12, lineHeight: 19, color: '#31552a', textDecorationLine: 'underline' },
  linkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  detailsToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevron: { fontSize: 18, color: '#4a7a3a', lineHeight: 24 },
  details: { paddingTop: 16, borderTopWidth: 1, borderColor: '#e0ddd3', gap: 16 },
  detailGroup: { gap: 5 },
  detailTitle: { fontSize: 13, fontWeight: '700', color: '#1e3a1e' },
  review: { backgroundColor: '#f5efdf', borderRadius: 10, paddingHorizontal: 13 },
  reviewToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewTitle: { fontSize: 13, fontWeight: '700', color: '#6d542c' },
  reviewContent: { paddingBottom: 10, gap: 8 },
  candidate: { padding: 11, minHeight: 48, backgroundColor: '#fffdf8', borderRadius: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  candidateIdentity: { flexGrow: 1, flexShrink: 1, gap: 2 },
  candidateName: { fontSize: 13, fontWeight: '600', color: '#1e3a1e' },
  choose: { color: '#31552a', fontSize: 12 },
  disabled: { opacity: 0.5 },
  credit: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  creditLogo: { width: 102, height: 38 },
});
