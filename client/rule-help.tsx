import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useI18n } from './i18n';
import type { Surface } from './ui';
export const ruleHelp: Record<string, string> = {
  'short-prompts': 'A selected prompt contains 1–24 characters after trimming. Very brief task briefs can omit goals or constraints. Short confirmations and follow-ups can be appropriate; this rule does not judge their meaning.',
  'acceptance-criteria': 'With at least three selected prompts, fewer than 34% contain recognizable file paths, extensions, constraint or verification cues. Add an expected result and acceptance criteria. This German/English keyword heuristic can miss well-written prompts.',
  'verification-gap': 'At least one successful edit tool call is recorded, but no recognized test, typecheck, lint or build command. Ask for checks and their results. Checks outside this log or custom commands can be missed; this is not proof that testing was skipped.',
  'late-edits': 'The final edit message comes after the last recognized verification command. Later changes may invalidate earlier checks. Run relevant checks again. Tool ordering within a single message is not evaluated; command execution does not prove a passing result.',
  'tool-errors': 'At least three tool calls in this session have error status. Inspect causes before retrying. Different, unrelated failures also count, and an error may reflect permissions or the environment rather than poor prompting.',
  'retry-loop': 'The same tool and command or file operation failed at least three times. Repeating without adjusting the approach may waste effort. Matching uses tool name plus command, file or call ID; it does not compare intent or prove the attempts were consecutive.',
  'session-hygiene': 'More than 30 prompts from the selected origin occur in one session. Consider a focused follow-up when the goal changes and preserve decisions and test status. Long sessions can be useful; this threshold alone does not mean the context is poor.',
  'context-pressure': 'At least three context compactions are recorded. Summaries can lose details, so preserve important decisions and checks. Compaction is normal and does not itself establish information loss or an error.',
};
export function RuleHelp({ theme, rule, onOpenChange }: Surface & { rule: string; onOpenChange?: (open: boolean) => void }) {
  const [hover, setHover] = useState(false), [focused, setFocused] = useState(false), [pinned, setPinned] = useState(false);
  const open = hover || focused || pinned, c = theme.colors, { t } = useI18n();
  const update = (kind: 'hover' | 'focus' | 'pin', value: boolean) => {
    if (kind === 'hover') setHover(value); else if (kind === 'focus') setFocused(value); else setPinned(value);
    onOpenChange?.(kind === 'hover' ? value || focused || pinned : kind === 'focus' ? hover || value || pinned : hover || focused || value);
  };
  return <View onPointerEnter={() => update('hover', true)} onPointerLeave={() => update('hover', false)} style={{ alignItems: 'flex-end', position: 'relative' }}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('Explain this anti-pattern')} accessibilityState={{ expanded: open }}
      onHoverIn={() => update('hover', true)} onFocus={() => update('focus', true)} onBlur={() => update('focus', false)}
      onPress={() => { setFocused(false); setHover(false); setPinned(!pinned); onOpenChange?.(!pinned); }} style={{ padding: 6 }}>
      <Text style={{ color: c.foregroundMuted, fontSize: 19 }}>ⓘ</Text>
    </Pressable>
    {open && <View accessibilityRole="text" style={{ position: 'absolute', right: 0, top: 36, width: 280, maxWidth: 280, padding: 16, gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.surface0, zIndex: 10 }}>
      <Text style={{ color: c.foreground, fontWeight: '600' }}>Meaning and detection</Text>
      <Text style={{ color: c.foreground, fontSize: 12 }}>{ruleHelp[rule] ?? 'This local rule highlights a signal in the available session log. Review the evidence and context before drawing conclusions.'}</Text>
      <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Each rule counts once per affected session. Percentages use analyzed sessions in the current filters. Prompt rules use the selected message origin; tool and context rules inspect the full included session. These are coaching signals, not a quality score.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Close explanation')} onPress={() => { setPinned(false); setFocused(false); setHover(false); onOpenChange?.(false); }}><Text style={{ color: c.accent }}>Close explanation</Text></Pressable>
    </View>}
  </View>;
}
