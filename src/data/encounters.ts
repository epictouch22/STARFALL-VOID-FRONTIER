export type EncounterKind = "sos" | "inspection" | "beacon";
export type EncounterChoice = {
  id: string;
  title: string;
  description: string;
  cost?: Record<string, number>;
  credits?: number;
  fuel?: number;
  energy?: number;
  reward?: Record<string, number>;
  payment?: number;
  reputation?: Record<number, number>;
  hullDamage?: number;
  radiation?: number;
  route?: boolean;
  pursuit?: boolean;
  remote?: boolean;
};
export const encounterDefinitions: Record<
  EncounterKind,
  {
    title: string;
    text: string;
    choices: EncounterChoice[];
  }
> = {
  sos: {
    title: "SOS · Последний воздух",
    text: "У обломков дрейфует спасательная капсула. Два геолога ещё живы, но регенератор воздуха отказал. Спасательная служба платит за стабилизацию капсулы; автоподбор без помощи не состоится.",
    choices: [
      {
        id: "rescue",
        title: "Стабилизировать капсулу",
        description:
          "1 аптечка + 1 кислородный баллон → ₡220 и +8 колонистам. Подойти на 300 м; служба заберёт выживших.",
        cost: { medkit: 1, oxygen: 1 },
        payment: 220,
        reputation: { 2: 8 },
      },
      {
        id: "tow",
        title: "Провести дистанционную буксировку",
        description:
          "8 топлива + 15 энергии → ₡80 и +3 колонистам. Буксировочный дрон доставит капсулу в безопасный коридор.",
        fuel: 8,
        energy: 15,
        payment: 80,
        reputation: { 2: 3 },
        remote: true,
      },
      {
        id: "ignore",
        title: "Отклонить сигнал",
        description: "Без затрат; −3 колонистам. Решение окончательное.",
        reputation: { 2: -3 },
        remote: true,
      },
    ],
  },
  inspection: {
    title: "Патруль · Досмотр груза",
    text: "Таможенный патруль требует транзитную декларацию. Запечатанные контрактные грузы защищены документами и не подлежат изъятию. Ваш личный груз проверяется отдельно.",
    choices: [
      {
        id: "declare",
        title: "Оплатить декларацию",
        description: "₡60 → +3 Союзу. Патруль закроет проверку.",
        credits: 60,
        reputation: { 0: 3 },
        remote: true,
      },
      {
        id: "samples",
        title: "Передать образцы для анализа",
        description:
          "2 кристалла → +5 Союзу. Контрактные манифесты останутся на борту.",
        cost: { crystal: 2 },
        reputation: { 0: 5 },
        remote: true,
      },
      {
        id: "evade",
        title: "Уйти от досмотра",
        description:
          "8 топлива, −12 корпуса и −10 Союзу. Только в космосе; появится преследователь.",
        fuel: 8,
        hullDamage: 12,
        reputation: { 0: -10 },
        pursuit: true,
        remote: true,
      },
    ],
  },
  beacon: {
    title: "Древний маяк · Забытый путь",
    text: "За помехами аномалии работает навигационный узел Хора. Он хранит координаты скрытой системы этого региона. Блок памяти можно считать или разобрать; дважды использовать его нельзя.",
    choices: [
      {
        id: "decode",
        title: "Расшифровать память",
        description:
          "30 энергии → 2 экзоматерии и маршрут к скрытой системе. Подойти на 300 м; сюжетный ключ это не заменяет.",
        energy: 30,
        reward: { exo: 2 },
        route: true,
      },
      {
        id: "salvage",
        title: "Разобрать маяк",
        description:
          "4 кристалла + 3 меди; +8 радиации. Подойти на 300 м. Координаты будут потеряны.",
        reward: { crystal: 4, copper: 3 },
        radiation: 8,
      },
      {
        id: "silence",
        title: "Заглушить передачу",
        description:
          "Без затрат; +2 колонистам. Сигнал больше не привлечёт корабли.",
        reputation: { 2: 2 },
        remote: true,
      },
    ],
  },
};
