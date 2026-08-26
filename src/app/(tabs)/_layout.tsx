import { useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { breakpoint, fontRoles, typeScale } from '@/theme';

export default function TabsLayout() {
  const { t, language, isRTL } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= breakpoint.wide;
  // Explicit bidi for tab labels — `forceRTL` alone is unreliable on web.
  const dir = { writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const) };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.faint,
        // Note: don't pad the bar itself — tabBarStyle would override the
        // safe-area inset and push icons/labels under the home indicator.
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        // Phones: icon-only tabs (labels clipped inside the measured bar
        // height; hiding them sidesteps that and reads cleaner anyway).
        // Wide: labels beside icons. RTL mirrors via `forceRTL` on native and
        // `document.dir` on web (set in I18nProvider) — covers tab order too.
        tabBarShowLabel: isWide,
        tabBarLabelPosition: 'beside-icon',
        tabBarLabelStyle: {
          fontFamily: fonts.uiSemibold,
          fontSize: typeScale.micro.size,
          ...dir,
        },
        sceneStyle: { backgroundColor: c.paper },
      }}>
      <Tabs.Screen
        name="gallery"
        options={{
          title: t.tabs.gallery,
          tabBarIcon: ({ focused, color, size }) => (
            <Icon
              name="grid"
              color={typeof color === 'string' ? color : c.ink}
              size={size}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.tabs.settings,
          tabBarIcon: ({ focused, color, size }) => (
            <Icon
              name="settings"
              color={typeof color === 'string' ? color : c.ink}
              size={size}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
