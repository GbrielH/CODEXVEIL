import { Tabs } from 'expo-router';
import { LayoutDashboard, Puzzle, ScrollText, Swords, UserRound } from 'lucide-react-native';
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
          minHeight: 64,
          paddingTop: 6,
        },
        tabBarActiveBackgroundColor: 'rgba(87, 31, 43, 0.35)',
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 6, marginVertical: 4 },
        tabBarActiveTintColor: colors.fgAccent,
        tabBarInactiveTintColor: colors.fgMuted,
        // Só ícones: os nomes não cabem em telas estreitas (o leitor de tela ainda anuncia o título).
        tabBarShowLabel: false,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
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
          title: 'Comunidade',
          tabBarIcon: ({ color, size }) => <Puzzle color={color} size={size} />,
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
