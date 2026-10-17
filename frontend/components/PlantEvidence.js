import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, ActivityIndicator } from 'react-native';
import { confirmationCandidates, evidenceText, identificationNeedsConfirmation, identificationProvider, safeEvidenceUrl, taxonomyStatus } from '../utils/plantEvidence';

const PLANTNET_LOGO = require('../../assets/powered-by-plantnet-light.png');

export function EvidenceLink({ url, children }) {
  const [error, setError] = useState(false);
  const safeUrl = safeEvidenceUrl(url);
  if (!safeUrl) return null;
  return <View>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel={typeof children === 'string' ? children : 'Read evidence source'} onPress={() => { setError(false); Linking.openURL(safeUrl).catch(() => setError(true)); }} style={styles.linkButton}>
      <Text style={styles.link}>{children || 'Read source'} ↗</Text>
    </TouchableOpacity>
    {error && <Text accessibilityLiveRegion="polite" style={styles.small}>Could not open the source. Address: {safeUrl}</Text>}
  </View>;
}

export default function PlantEvidence({ plant = {}, onConfirm, onRetake, confirming = false }) {
  plant = plant && typeof plant === 'object' && !Array.isArray(plant) ? plant : {};
  const text = (field) => evidenceText(plant[field]);
  const status = taxonomyStatus(plant);
  const needsReview = identificationNeedsConfirmation(plant);
  const provider = plant.id_source;
  const candidates = confirmationCandidates(plant).filter((candidate) => !plant.needs_taxon_confirmation || candidate.scientific_name !== plant.scientific_name);
  const support = ['high', 'medium', 'low'].includes(plant.wildlife_support) ? plant.wildlife_support : null;
  const supportEvidence = text('wildlife_support_reason') || (plant.wildlife_support_verified ? text('why') : '');
  const zones = text('fisc_zones');
  const actions = (Array.isArray(plant.actions) ? plant.actions : []).filter((item) => item && evidenceText(item.action));
  const colors = { native: '#e3eedb', invasive: '#fbe4d9', nonnative: '#f9edcf', unknown: '#ecece6' };
  return <View style={styles.card}>
    <Text style={styles.overline}>IDENTIFICATION</Text>
    <Text accessibilityRole="header" style={styles.name}>{text('plant_name') || text('common_name') || 'Plant not yet identified'}</Text>
    {!!text('scientific_name') && <Text style={styles.scientific}>{text('scientific_name')}</Text>}
    <Text style={styles.small}>{plant.user_confirmed ? 'Identification selected by you; status checked again against plant records.' : identificationProvider(provider)}</Text>
    {!plant.user_confirmed && Number.isFinite(plant.confidence) && <Text style={styles.small}>Identification confidence: {Math.round(plant.confidence * 100)}%. This is not a measure of habitat quality.</Text>}
    {needsReview && <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Review the identification</Text>
      <Text style={styles.body}>Similar plants can have different Florida status. Compare the scientific names with a field guide or a knowledgeable reviewer. The status below applies to the named plant, not proof of what is in your photo.</Text>
      {!!text('taxonomy_notes') && <Text style={styles.body}>{text('taxonomy_notes')}</Text>}
      {plant.needs_taxon_confirmation && <Text style={styles.body}>A variety or subspecies still needs to be identified. These catalog alternatives are not predictions from your photo. Choose one only after checking its distinguishing features, or retain this observation as unresolved.</Text>}
      {!!onConfirm && candidates.map((candidate) => <TouchableOpacity key={candidate.scientific_name} accessibilityRole="button" accessibilityLabel={`Confirm ${candidate.scientific_name}`} disabled={confirming} accessibilityState={{ disabled: confirming }} aria-disabled={confirming} onPress={() => onConfirm(candidate.scientific_name)} style={styles.candidate}>
        <Text style={styles.candidateName}>{evidenceText(candidate.common_name) || evidenceText(candidate.plant_name) || candidate.scientific_name}</Text>
        <Text style={styles.small}>{candidate.scientific_name}</Text>
        {!!evidenceText(candidate.confirmation_note) && <Text style={styles.small}>{evidenceText(candidate.confirmation_note)}</Text>}
        <Text style={styles.link}>I checked this identification</Text>
      </TouchableOpacity>)}
      {!!onRetake && <TouchableOpacity accessibilityRole="button" disabled={confirming} accessibilityState={{ disabled: confirming }} aria-disabled={confirming} onPress={onRetake} style={styles.linkButton}><Text style={styles.link}>Use another photo</Text></TouchableOpacity>}
      {confirming && <ActivityIndicator accessibilityLabel="Checking selected species" color="#1e3a1e" />}
    </View>}
    <View style={styles.divider} />
    <Text style={styles.overline}>FLORIDA STATUS</Text>
    <View style={[styles.badge, { backgroundColor: colors[status.tone] }]}><Text style={styles.badgeText}>{status.label}{needsReview && status.tone !== 'unknown' ? ' · if identification is correct' : ''}</Text></View>
    <Text style={styles.small}>{text('status_scope') || 'Florida species records; this does not establish suitability for every planting site.'}</Text>
    {!!text('why') && <Text style={styles.body}>{text('why')}</Text>}
    {!!text('source') && <Text style={styles.small}>Record: {text('source')}{text('verified_on') ? ` · checked ${text('verified_on')}` : ''}</Text>}
    {!!text('fisc_category') && <Text style={styles.small}>FISC category: {text('fisc_category')}{zones ? ` · reported zones: ${zones}` : ''}</Text>}
    {!!text('distribution_note') && <Text style={styles.small}>{text('distribution_note')}</Text>}
    <EvidenceLink url={plant.source_url}>Florida status source</EvidenceLink>
    <Text style={styles.overline}>WILDLIFE RELATIONSHIPS</Text>
    <Text style={styles.body}>{supportEvidence || 'A specific wildlife relationship has not yet been verified for this plant.'}</Text>
    {support && !!supportEvidence && <Text style={styles.small}>Catalog support category: {support}. This is a descriptive category, not measured wildlife at your site.</Text>}
    <EvidenceLink url={plant.why_source_url || plant.wildlife_source_url}>Wildlife relationship source</EvidenceLink>
    {(plant.suggested_status && plant.suggested_status !== 'unknown' || plant.suggested_wildlife_reason) && <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Unverified suggestion</Text>
      {text('suggested_status') && text('suggested_status') !== 'unknown' && <Text style={styles.body}>Possible Florida status: {text('suggested_status')}. A Florida source is still needed.</Text>}
      {!!text('suggested_wildlife_reason') && <Text style={styles.body}>{text('suggested_wildlife_reason')}</Text>}
      <Text style={styles.small}>{text('suggestion_note') || 'This suggestion is excluded from verified survey totals and planting selections.'}</Text>
    </View>}
    {!!text('inat_note') && <Text style={styles.small}>Nearby observation context: {text('inat_note')}</Text>}
    {plant.ai_unavailable && <View style={styles.notice}><Text style={styles.body}>Additional explanation is temporarily unavailable. Available identification and sourced plant records are still shown.</Text></View>}
    {actions.length > 0 && !needsReview && <View style={styles.actions}>
      <Text style={styles.overline}>NEXT STEPS TO CONSIDER</Text>
      {actions.map((item, index) => <View key={index}><Text style={styles.action}>{evidenceText(item.action)}</Text>{!!evidenceText(item.impact) && <Text style={styles.body}>{evidenceText(item.impact)}</Text>}</View>)}
    </View>}
    {(provider === 'plantnet' || provider === 'openai_adjudicated') && <TouchableOpacity accessibilityRole="link" accessibilityLabel="Plant identification supported by Pl@ntNet" onPress={() => Linking.openURL('https://plantnet.org').catch(() => {})} style={styles.credit}>
      <Image source={PLANTNET_LOGO} style={styles.creditLogo} resizeMode="contain" accessibilityLabel="Powered by Pl@ntNet" />
      <Text style={styles.small}>{provider === 'openai_adjudicated' ? 'Candidate species supplied by Pl@ntNet' : 'Plant identification powered by Pl@ntNet'}</Text>
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fffdf8', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d4cfc4', gap: 9 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#4a7a3a', marginTop: 5 },
  name: { fontSize: 25, fontWeight: '700', color: '#1e3a1e' },
  scientific: { fontSize: 16, fontStyle: 'italic', color: '#4a4a3a' },
  body: { fontSize: 14, lineHeight: 22, color: '#4a4a3a' },
  small: { fontSize: 12, lineHeight: 19, color: '#646454' },
  badge: { borderRadius: 8, padding: 9, alignSelf: 'flex-start' },
  badgeText: { color: '#1e3a1e', fontWeight: '600', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#d4cfc4', marginVertical: 7 },
  link: { fontSize: 13, lineHeight: 20, color: '#2f6026', textDecorationLine: 'underline' },
  linkButton: { minHeight: 44, justifyContent: 'center' },
  notice: { padding: 14, borderRadius: 10, backgroundColor: '#f9edcf', gap: 9 },
  noticeTitle: { fontSize: 15, fontWeight: '700', color: '#4a4a3a' },
  candidate: { padding: 12, minHeight: 44, backgroundColor: '#fffdf8', borderRadius: 8, gap: 3 },
  candidateName: { fontSize: 14, fontWeight: '600', color: '#1e3a1e' },
  actions: { gap: 12, marginTop: 8 },
  action: { fontSize: 14, fontWeight: '600', color: '#1e3a1e', lineHeight: 22 },
  credit: { alignItems: 'center', marginTop: 12, gap: 8 },
  creditLogo: { width: 160, height: 60 },
});
