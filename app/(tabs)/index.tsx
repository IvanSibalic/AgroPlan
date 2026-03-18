import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { TriangleAlert as AlertTriangle, TrendingUp, Activity, Package } from 'lucide-react-native';
import {
  getTotalArea,
  getActivities,
  getLowStockItems,
  type Activity as ActivityType,
  type InventoryItem,
} from '@/services/api';

export default function Dashboard() {
  const [totalArea, setTotalArea] = useState(0);
  const [recentActivities, setRecentActivities] = useState<ActivityType[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [area, activities, lowStock] = await Promise.all([
        getTotalArea(),
        getActivities(3),
        getLowStockItems(),
      ]);

      setTotalArea(area);
      setRecentActivities(activities);
      setLowStockItems(lowStock);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activityTypeLabels: Record<string, string> = {
    sjetva: 'Sjetva',
    gnojidba: 'Gnojidba',
    zaštita: 'Zaštita bilja',
    žetva: 'Žetva',
    oranje: 'Oranje',
    kultivacija: 'Kultivacija',
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="bg-primary-600 px-6 pt-14 pb-8">
        <Text className="text-white text-3xl font-bold mb-2">
          Nadzorna ploča
        </Text>
        <Text className="text-primary-100 text-base">
          Pregled vašeg gospodarstva
        </Text>
      </View>

      <View className="px-6 -mt-4">
        {/* Total Area Card */}
        <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-600 text-base font-semibold">
              Ukupna površina
            </Text>
            <TrendingUp size={24} color="#16a34a" />
          </View>
          <Text className="text-4xl font-bold text-gray-900">
            {totalArea.toFixed(2)}
            <Text className="text-xl text-gray-500"> ha</Text>
          </Text>
        </View>

        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <View className="bg-amber-50 rounded-2xl p-6 mb-4 border border-amber-200">
            <View className="flex-row items-center mb-3">
              <AlertTriangle size={24} color="#d97706" />
              <Text className="text-amber-900 text-lg font-bold ml-2">
                Upozorenja
              </Text>
            </View>
            {lowStockItems.map((item) => (
              <View
                key={item.id}
                className="flex-row justify-between items-center py-2 border-b border-amber-100 last:border-b-0"
              >
                <View>
                  <Text className="text-amber-900 font-semibold">
                    {item.name}
                  </Text>
                  <Text className="text-amber-700 text-sm">
                    Kategorija: {item.category}
                  </Text>
                </View>
                <Text className="text-amber-900 font-bold">
                  {item.quantity} {item.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Activities */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <Activity size={24} color="#16a34a" />
              <Text className="text-gray-900 text-lg font-bold ml-2">
                Nedavne aktivnosti
              </Text>
            </View>
          </View>

          {loading ? (
            <Text className="text-gray-500 text-center py-4">
              Učitavanje...
            </Text>
          ) : recentActivities.length === 0 ? (
            <Text className="text-gray-500 text-center py-4">
              Nema evidentiranih aktivnosti
            </Text>
          ) : (
            recentActivities.map((activity) => (
              <View
                key={activity.id}
                className="py-4 border-b border-gray-100 last:border-b-0"
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-gray-900 font-semibold text-base flex-1">
                    {activityTypeLabels[activity.activity_type] ||
                      activity.activity_type}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {new Date(activity.date).toLocaleDateString('hr-HR')}
                  </Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Text className="text-gray-600 text-sm">
                    Radnik: {activity.worker_name}
                  </Text>
                </View>
                {activity.machinery && (
                  <Text className="text-gray-500 text-sm mt-1">
                    Mehanizacija: {activity.machinery}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Quick Stats */}
        <View className="flex-row gap-4 mb-6">
          <View className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <Package size={28} color="#16a34a" />
            <Text className="text-2xl font-bold text-gray-900 mt-3">
              {lowStockItems.length}
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              Niske zalihe
            </Text>
          </View>

          <View className="flex-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <Activity size={28} color="#16a34a" />
            <Text className="text-2xl font-bold text-gray-900 mt-3">
              {recentActivities.length}
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              Akt. ovaj tjedan
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
