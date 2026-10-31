import { Tabs } from 'expo-router';
import { LayoutDashboard, Library, ScrollText, Swords, UserRound } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';

/** Navegação principal: abas inferiores com alvos de toque grandes. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.fgAccent,
        headerTitleStyle: { fontFamily: fonts.display },
        tabBarStyle: {
          backgroundColor: colors.raised,
          borderTopColor: colors.line,
          height: 72,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarActiveBackgroundColor: 'rgba(107, 59, 198, 0.28)',
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3, paddingVertical: 2 },
        tabBarActiveTintColor: colors.fgAccent,
        tabBarInactiveTintColor: colors.fgMuted,
        // Ícone com o nome embaixo (curto, cabe em telas estreitas).
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10, marginTop: 2 },
        tabBarAllowFontScaling: false,
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Painel',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="campanhas"
        options={{
          title: 'Campanhas',
          tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="personagens"
        options={{
          title: 'Personagens',
          tabBarIcon: ({ color, size }) => <Swords color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="comunidade"
        options={{
          title: 'Sistemas',
          tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
