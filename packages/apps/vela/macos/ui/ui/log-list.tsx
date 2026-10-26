/**
 * A log, read the way logs are read: scanned by time, skimmed by severity. A
 * fixed monospace time column, a colored level, then the message as the
 * subject with its area as a quiet prefix.
 */
import { Text, View } from 'nsh';
import { edges, geometry, levelText, text, type } from './tokens';

export interface LogLine {
  readonly key: string;
  readonly time: string;
  readonly level: 'error' | 'warn' | 'info';
  readonly levelLabel: string;
  readonly area: string;
  readonly message: string;
}

export function LogList(props: { lines: readonly LogLine[]; testID?: string }) {
  return (
    <View testID={props.testID}>
      <Each of={props.lines} key={(line) => line.key}>
        {(line) => (
          <View class={`flex-row items-start gap-2 px-3 py-1.5 first:border-t-0 ${edges.top}`}>
            <Text class={`${geometry.logTime} ${type.mono} ${text.muted}`}>{line().time}</Text>
            <Text class={`${geometry.logLevel} ${type.mono} font-semibold ${levelText[line().level]}`}>
              {line().levelLabel}
            </Text>
            <Text selectable class={`min-w-0 flex-1 ${type.caption} ${text.primary}`}>
              <Text class={text.muted}>{line().area} </Text>
              {line().message}
            </Text>
          </View>
        )}
      </Each>
    </View>
  );
}
