import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Package, TriangleAlert as AlertTriangle, Plus, Minus } from 'lucide-react-native';
import {
  getInventory,
  updateInventoryQuantity,
  createInventoryItem,
  type InventoryItem,
} from '@/services/api';

export default function Warehouse() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<
    'sjeme' | 'gnojivo' | 'zaštita' | 'gorivo'
  >('sjeme');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('kg');
  const [newItemMinQuantity, setNewItemMinQuantity] = useState('');

  const loadData = async () => {
    try {
      const data = await getInventory();
      setInventory(data);
    } catch (error) {
      console.error('Error loading inventory:', error);
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

  const categories = [
    { value: 'all', label: 'Sve', emoji: '📦' },
    { value: 'sjeme', label: 'Sjeme', emoji: '🌾' },
    { value: 'gnojivo', label: 'Gnojivo', emoji: '🧪' },
    { value: 'zaštita', label: 'Zaštita', emoji: '🛡️' },
    { value: 'gorivo', label: 'Gorivo', emoji: '⛽' },
  ];

  const units = ['kg', 'l', 'kom', 't'];

  const filteredInventory =
    selectedCategory === 'all'
      ? inventory
      : inventory.filter((item) => item.category === selectedCategory);

  const handleUpdateQuantity = async (
    id: string,
    currentQuantity: number,
    delta: number
  ) => {
    const newQuantity = Math.max(0, currentQuantity + delta);
    const result = await updateInventoryQuantity(id, newQuantity);
    if (result) {
      loadData();
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName || !newItemQuantity || !newItemMinQuantity) {
      Alert.alert('Greška', 'Molimo popunite sva polja');
      return;
    }

    const newItem = {
      name: newItemName,
      category: newItemCategory,
      quantity: parseFloat(newItemQuantity),
      unit: newItemUnit,
      min_quantity: parseFloat(newItemMinQuantity),
    };

    const result = await createInventoryItem(newItem);
    if (result) {
      setShowAddModal(false);
      resetForm();
      loadData();
    } else {
      Alert.alert('Greška', 'Nije moguće dodati artikl');
    }
  };

  const resetForm = () => {
    setNewItemName('');
    setNewItemCategory('sjeme');
    setNewItemQuantity('');
    setNewItemUnit('kg');
    setNewItemMinQuantity('');
  };

  const isLowStock = (item: InventoryItem) =>
    item.quantity <= item.min_quantity;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-600 px-6 pt-14 pb-6">
        <Text className="text-white text-3xl font-bold mb-2">Skladište</Text>
        <Text className="text-primary-100 text-base">
          {inventory.length} artikala u zalihi
        </Text>
      </View>

      {/* Category Filter */}
      <View className="bg-white border-b border-gray-200">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-6 py-4"
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.value}
              onPress={() => setSelectedCategory(category.value)}
              className={`mr-3 px-5 py-3 rounded-xl ${
                selectedCategory === category.value
                  ? 'bg-primary-100 border-2 border-primary-600'
                  : 'bg-gray-100'
              }`}
            >
              <Text className="text-lg">
                {category.emoji}{' '}
                <Text
                  className={`font-semibold ${
                    selectedCategory === category.value
                      ? 'text-primary-700'
                      : 'text-gray-700'
                  }`}
                >
                  {category.label}
                </Text>
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="py-4">
          {loading ? (
            <Text className="text-gray-500 text-center py-8">
              Učitavanje...
            </Text>
          ) : filteredInventory.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <Package size={48} color="#d1d5db" />
              <Text className="text-gray-500 text-center mt-4 text-base">
                Nema artikala u ovoj kategoriji
              </Text>
              <Text className="text-gray-400 text-center mt-2 text-sm">
                Dodajte prvi artikl u skladište
              </Text>
            </View>
          ) : (
            filteredInventory.map((item) => (
              <View
                key={item.id}
                className={`rounded-2xl p-5 mb-4 shadow-sm border ${
                  isLowStock(item)
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-white border-gray-100'
                }`}
              >
                <View className="flex-row items-start justify-between mb-4">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      {isLowStock(item) && (
                        <AlertTriangle size={20} color="#d97706" />
                      )}
                      <Text
                        className={`text-xl font-bold ml-1 ${
                          isLowStock(item) ? 'text-amber-900' : 'text-gray-900'
                        }`}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm mt-1 ${
                        isLowStock(item) ? 'text-amber-700' : 'text-gray-500'
                      }`}
                    >
                      {categories.find((c) => c.value === item.category)
                        ?.label || item.category}
                    </Text>
                  </View>
                  <View
                    className={`px-4 py-2 rounded-lg ${
                      isLowStock(item) ? 'bg-amber-200' : 'bg-primary-100'
                    }`}
                  >
                    <Text
                      className={`font-bold text-lg ${
                        isLowStock(item) ? 'text-amber-900' : 'text-primary-700'
                      }`}
                    >
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                </View>

                {isLowStock(item) && (
                  <View className="bg-amber-200 px-3 py-2 rounded-lg mb-4">
                    <Text className="text-amber-900 font-semibold text-sm">
                      ⚠️ Niske zalihe! Min. {item.min_quantity} {item.unit}
                    </Text>
                  </View>
                )}

                {/* Quick Quantity Update */}
                <View className="flex-row items-center justify-between border-t border-gray-200 pt-4">
                  <Text className="text-gray-600 font-semibold">
                    Brza izmjena:
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={() =>
                        handleUpdateQuantity(item.id, item.quantity, -10)
                      }
                      className="bg-red-100 w-12 h-12 rounded-xl items-center justify-center"
                    >
                      <Minus size={24} color="#dc2626" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleUpdateQuantity(item.id, item.quantity, -1)
                      }
                      className="bg-red-50 w-12 h-12 rounded-xl items-center justify-center"
                    >
                      <Text className="text-red-600 font-bold text-xl">-1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleUpdateQuantity(item.id, item.quantity, 1)
                      }
                      className="bg-green-50 w-12 h-12 rounded-xl items-center justify-center"
                    >
                      <Text className="text-green-600 font-bold text-xl">
                        +1
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleUpdateQuantity(item.id, item.quantity, 10)
                      }
                      className="bg-green-100 w-12 h-12 rounded-xl items-center justify-center"
                    >
                      <Plus size={24} color="#16a34a" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        className="absolute bottom-8 right-6 bg-primary-600 w-16 h-16 rounded-full items-center justify-center shadow-lg"
        activeOpacity={0.8}
      >
        <Plus size={32} color="#ffffff" />
      </TouchableOpacity>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 bg-gray-50">
          <View className="bg-primary-600 px-6 pt-14 pb-6">
            <Text className="text-white text-2xl font-bold">
              Novi artikl
            </Text>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            {/* Name */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Naziv *
              </Text>
              <TextInput
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Npr. NPK 15-15-15"
                className="bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-900 text-base"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Category */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Kategorija *
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {categories.slice(1).map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    onPress={() =>
                      setNewItemCategory(
                        category.value as 'sjeme' | 'gnojivo' | 'zaštita' | 'gorivo'
                      )
                    }
                    className={`px-5 py-4 rounded-xl border-2 ${
                      newItemCategory === category.value
                        ? 'bg-primary-100 border-primary-600'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className="text-lg">{category.emoji}</Text>
                    <Text
                      className={`font-semibold mt-1 ${
                        newItemCategory === category.value
                          ? 'text-primary-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quantity */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Količina *
              </Text>
              <TextInput
                value={newItemQuantity}
                onChangeText={setNewItemQuantity}
                placeholder="0"
                keyboardType="decimal-pad"
                className="bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-900 text-base"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Unit */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Mjerna jedinica *
              </Text>
              <View className="flex-row gap-3">
                {units.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setNewItemUnit(unit)}
                    className={`px-5 py-4 rounded-xl border-2 ${
                      newItemUnit === unit
                        ? 'bg-primary-100 border-primary-600'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`font-semibold ${
                        newItemUnit === unit
                          ? 'text-primary-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Min Quantity */}
            <View className="mb-6">
              <Text className="text-gray-700 font-semibold mb-3 text-base">
                Minimalna količina *
              </Text>
              <TextInput
                value={newItemMinQuantity}
                onChangeText={setNewItemMinQuantity}
                placeholder="0"
                keyboardType="decimal-pad"
                className="bg-white border-2 border-gray-200 rounded-xl px-5 py-4 text-gray-900 text-base"
                placeholderTextColor="#9ca3af"
              />
              <Text className="text-gray-500 text-sm mt-2">
                Dobit ćete upozorenje kada zalihe padnu ispod ove količine
              </Text>
            </View>

            {/* Buttons */}
            <View className="flex-row gap-4 mb-8">
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 py-5 rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="text-gray-700 text-center font-bold text-lg">
                  Odustani
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateItem}
                className="flex-1 bg-primary-600 py-5 rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="text-white text-center font-bold text-lg">
                  Dodaj
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
