import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';

import { Button, Card, EmptyState, Icon } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { DEFAULT_CANVASES, useSettings } from '@/storage/settings';
import { listProjects, saveProject } from '@/storage/projects';
import { getThumb } from '@/storage/thumbs';
import { fontRoles, spacing, typeScale } from '@/theme';
import type { MidadProject } from '@/storage/project-schema';

function makeNewProject(index: number): MidadProject {
  const now = new Date().toISOString();
  const size = DEFAULT_CANVASES[index];
  return {
    version: 1,
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Untitled',
    createdAt: now,
    updatedAt: now,
    canvas: {
      width: size.width,
      height: size.height,
      background: { type: 'paper', color: '#F7F6F3' },
    },
    objects: [],
    gridEnabled: false,
  };
}

function formatDate(iso: string, language: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GalleryScreen() {
  const router = useRouter();
  const { t, language } = useT();
  const { colors: c } = useTheme();
  const fonts = fontRoles[language];
  const insets = useSafeAreaInsets();
  const { defaultCanvasIndex } = useSettings();

  const [projects, setProjects] = useState<MidadProject[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  // Fetch projects on mount. All setState calls happen after the async
  // `listProjects()` resolves, so they are not synchronous within the effect.
  useEffect(() => {
    let active = true;
    listProjects().then(async (list) => {
      if (active) {
        setProjects(list);
        setLoading(false);
      }
      const entries = await Promise.all(
        list.map(async (p) => [p.id, await getThumb(p.id)] as const),
      );
      if (active) {
        setThumbs(Object.fromEntries(entries));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const createNew = useCallback(async () => {
    const project = makeNewProject(defaultCanvasIndex);
    await saveProject(project);
    router.push(`/editor?id=${project.id}`);
  }, [defaultCanvasIndex, router]);

  const openProject = useCallback(
    (id: string) => {
      router.push(`/editor?id=${id}`);
    },
    [router],
  );

  return (
    <View style={[styles.safe, { backgroundColor: c.paper, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { fontFamily: fonts.uiBold, color: c.ink }]}>
            {t.gallery.title}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: fonts.ui, color: c.muted }]}>
            {projects.length} · {t.gallery.designCard}
          </Text>
        </View>
        <Button label={t.gallery.newDesign} onPress={createNew} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.ink} />
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            glyph="خط"
            title={t.gallery.emptyTitle}
            description={t.gallery.emptyBody}>
            <Button label={t.gallery.newDesign} onPress={createNew} />
          </EmptyState>
        </View>
      ) : (
        <FlashList
          data={projects}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: spacing.xxxl + insets.bottom },
          ]}
          renderItem={({ item }) => {
            const ratio = item.canvas.height / item.canvas.width;
            const thumbUri = thumbs[item.id];
            return (
              <Card onPress={() => openProject(item.id)} style={styles.card}>
                <View
                  style={[
                    styles.thumb,
                    {
                      aspectRatio: ratio,
                      backgroundColor: item.canvas.background.color ?? c.surfaceAlt,
                      borderColor: c.border,
                    },
                  ]}>
                  {thumbUri ? (
                    <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : (
                    <Icon name="sparkle" color={c.faint} size={22} />
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text
                    numberOfLines={1}
                    style={[styles.cardName, { fontFamily: fonts.ui, color: c.ink }]}>
                    {item.name || t.gallery.untitled}
                  </Text>
                  <Text style={[styles.cardDate, { fontFamily: fonts.ui, color: c.faint }]}>
                    {formatDate(item.updatedAt, language)}
                  </Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typeScale.title.size,
    lineHeight: typeScale.title.lineHeight,
    letterSpacing: typeScale.title.letterSpacing,
  },
  subtitle: {
    fontSize: typeScale.caption.size,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.xxs,
  },
  cardName: {
    fontSize: typeScale.small.size,
    lineHeight: typeScale.small.lineHeight,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: typeScale.caption.size,
  },
});