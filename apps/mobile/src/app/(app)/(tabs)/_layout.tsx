import { Tabs } from 'expo-router';
import { LayoutDashboard, ScrollText, Swords, UserRound } from 'lucide-react-native';
import { colors, fonts } from '@/lib/theme';

/** Navegação principal: abas inferiores com alvos de toque grandes. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.raised },
        headerTintColor: colors.fgAccent,
        headerTitleStyle: { fontFamily: fonts.display },
        tabBarStyle: { backgroundColor: colors.raised, borderTopColor: colors.line, minHeight: 60 },
        tabBarActiveTintColor: colors.fgAccent,
        tabBarInactiveTintColor: colors.fgMuted,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Painel', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen name="campanhas" options={{ title: 'Campanhas', tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size} /> }} />
      <Tabs.Screen name="personagens" options={{ title: 'Personagens', tabBarIcon: ({ color, size }) => <Swords color={color} size={size} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
