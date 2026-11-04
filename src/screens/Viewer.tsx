import React from 'react';
import { ScrollView, View } from 'react-native';
import { mono, space } from '../theme';
import { AppText, Chip, Header, Screen, useTheme } from '../ui/kit';

/** Read-only file view, used for snapshots from history and for search hits. */
export function ViewerScreen({
  path,
  content,
  subtitle,
  onBack,
}: {
  path: string;
  content: string;
  subtitle?: string;
  onBack: () => void;
}) {
  const { palette } = useTheme();
  const lines = content.split('\n');
  return (
    <Screen>
      <Header
        title={path.split('/').pop() ?? path}
        subtitle={subtitle ?? path}
        onBack={onBack}
        actions={<Chip label="read-only" />}
      />
      <ScrollView contentContainerStyle={{ paddingVertical: space.sm }}>
        <ScrollView horizontal>
          <View style={{ paddingHorizontal: space.lg }}>
            {lines.map((line, index) => (
              <View key={index} style={{ flexDirection: 'row' }}>
                <AppText variant="mono" faint style={{ width: 34, textAlign: 'right', marginRight: space.sm }}>
                  {index + 1}
                </AppText>
                <AppText variant="mono" selectable style={{ color: palette.text, fontFamily: mono }}>
                  {line || ' '}
                </AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </Screen>
  );
}
