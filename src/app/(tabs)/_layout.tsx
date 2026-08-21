import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

export default function TabsLayout() {
  const { t } = useT();
  const { colors: c } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.faint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}>
      <Tabs.Screen
        name="gallery"
        options={{
          title: t.tabs.gallery,
          tabBarIcon: ({ color, size }) => (
            <Icon name="grid" color={typeof color === 'string' ? color : c.ink} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabs.settings,
          tabBarIcon: ({ color, size }) => (
            <Icon
              name="settings"
              color={typeof color === 'string' ? color : c.ink}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}