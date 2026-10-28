import type { TeaCategory } from "@/lib/types";

/** 처음 실행할 때 넣어두는 대표 중국 명차. 번체·한글명·산지 이름은 자동으로 채워집니다 */
export const SEED_TEAS: { name_zh: string; category: TeaCategory; origins: string[]; description: string }[] = [
  // 녹차
  {
    name_zh: "西湖龙井",
    category: "green",
    origins: ["330106"],
    description:
      "항저우 서호 주변 사봉(獅峰)·용정·운서 등지에서 나는 중국 10대 명차의 으뜸. 납작하게 눌러 덖은 잎에서 볶은 콩과 난초 같은 향이 나며, 청명 전에 딴 명전차(明前茶)를 최상으로 칩니다.",
  },
  {
    name_zh: "碧螺春",
    category: "green",
    origins: ["320506"],
    description:
      "쑤저우 태호(太湖)의 동정산(洞庭山)에서 나는 녹차. 소라처럼 말린 가는 잎에 흰 솜털이 덮여 있고, 과일나무 사이에서 자라 꽃과 과일 향이 짙습니다.",
  },
  {
    name_zh: "黄山毛峰",
    category: "green",
    origins: ["341003", "341021"],
    description: "황산 일대 고산지대의 녹차. 참새 혀처럼 생긴 여린 싹에 솜털이 있고, 맑고 향긋하며 단맛이 오래 남습니다.",
  },
  {
    name_zh: "太平猴魁",
    category: "green",
    origins: ["341003"],
    description: "황산구 태평호 일대의 녹차. 잎이 길고 곧으며 납작하게 눌린 독특한 모양으로, 난초 향이 그윽합니다.",
  },
  {
    name_zh: "六安瓜片",
    category: "green",
    origins: ["341503", "341524"],
    description: "싹과 줄기를 떼고 잎만 골라 만드는 독특한 녹차. 수박씨 모양의 잎에서 밤 향과 깊은 단맛이 납니다.",
  },
  {
    name_zh: "信阳毛尖",
    category: "green",
    origins: ["411502"],
    description: "허난성 신양의 대표 녹차로 중국 북방 녹차의 명품. 가늘고 곧은 잎과 신선하고 진한 맛이 특징입니다.",
  },
  {
    name_zh: "都匀毛尖",
    category: "green",
    origins: ["522701"],
    description: "구이저우 두윈의 녹차. 낚싯바늘처럼 휜 가는 잎에 솜털이 가득하며, 맑은 향과 상쾌한 맛을 냅니다.",
  },
  {
    name_zh: "竹叶青",
    category: "green",
    origins: ["511181"],
    description: "쓰촨 아미산(峨眉山)의 녹차. 대나무 잎처럼 납작하고 곧은 싹 모양에서 이름이 왔습니다.",
  },
  {
    name_zh: "安吉白茶",
    category: "green",
    origins: ["330523"],
    description: "이름은 백차지만 제법은 녹차. 잎의 엽록소가 적은 백엽 품종으로 만들어 아미노산이 풍부하고 감칠맛이 뛰어납니다.",
  },
  {
    name_zh: "恩施玉露",
    category: "green",
    origins: ["422801"],
    description: "후베이 은시의 녹차로, 중국에서는 드물게 찻잎을 쪄서 살청하는 증청(蒸靑) 방식을 이어오고 있습니다.",
  },
  // 백차
  {
    name_zh: "白毫银针",
    category: "white",
    origins: ["350982", "350725"],
    description: "푸딩·정허의 대백(大白) 품종 싹만 따서 시들리고 말린 최상급 백차. 은빛 솜털과 꿀 같은 단맛이 납니다.",
  },
  {
    name_zh: "白牡丹",
    category: "white",
    origins: ["350982", "350725"],
    description: "싹 하나에 잎 한두 장을 함께 따서 만든 백차. 펼쳐진 잎이 모란꽃 같다 하여 붙은 이름입니다.",
  },
  {
    name_zh: "寿眉",
    category: "white",
    origins: ["350982"],
    description: "다 자란 잎으로 만드는 백차. 해를 묵힐수록 대추와 약초 향이 깊어집니다. 백차를 두고 ‘1년은 차, 3년은 약, 7년은 보물’이라 합니다.",
  },
  // 황차
  {
    name_zh: "君山银针",
    category: "yellow",
    origins: ["430611"],
    description: "동정호(洞庭湖) 가운데 군산섬에서 나는 황차. 우리면 싹이 물속에서 곧게 섰다 가라앉기를 반복하는 모습이 유명합니다.",
  },
  {
    name_zh: "蒙顶黄芽",
    category: "yellow",
    origins: ["511803"],
    description: "차 재배의 발상지로 꼽히는 쓰촨 몽정산의 황차. 민황 공정을 거쳐 노란 탕색과 부드러운 단맛을 냅니다.",
  },
  {
    name_zh: "霍山黄芽",
    category: "yellow",
    origins: ["341525"],
    description: "안후이 곽산의 황차. 참새 혀 모양의 싹으로 만들며 밤 향과 맑은 단맛이 특징입니다.",
  },
  // 청차
  {
    name_zh: "铁观音",
    category: "oolong",
    origins: ["350524"],
    description: "푸젠 안시의 대표 우롱차. 둥글게 말린 무거운 잎에서 난초 향과 ‘관음운(觀音韻)’이라 불리는 여운이 납니다.",
  },
  {
    name_zh: "大红袍",
    category: "oolong",
    origins: ["350782"],
    description: "무이산 바위 틈에서 자라는 무이암차(武夷岩茶)의 왕. 숯불에 홍배(烘焙)해 바위의 기운, ‘암운(岩韻)’을 품습니다.",
  },
  {
    name_zh: "武夷肉桂",
    category: "oolong",
    origins: ["350782"],
    description: "계피 향을 닮은 강렬한 향으로 유명한 무이암차. 오늘날 무이산에서 가장 많이 재배되는 품종 중 하나입니다.",
  },
  {
    name_zh: "凤凰单丛",
    category: "oolong",
    origins: ["445103"],
    description: "광둥 차오저우 봉황산의 우롱차. 한 그루씩 따로 만든다는 뜻의 ‘단총’으로, 꿀·난·치자꽃 등 향형이 다양합니다.",
  },
  {
    name_zh: "冻顶乌龙",
    category: "oolong",
    origins: ["710000"],
    description: "타이완 난터우 동정산의 우롱차. 둥글게 말린 잎을 중간 정도 발효·홍배해 고소하고 부드러운 맛을 냅니다.",
  },
  {
    name_zh: "漳平水仙",
    category: "oolong",
    origins: ["350881"],
    description: "수선(水仙) 품종 우롱차를 네모난 종이에 눌러 굳힌 독특한 긴압 우롱차로, 맑은 꽃향이 납니다.",
  },
  // 홍차
  {
    name_zh: "正山小种",
    category: "black",
    origins: ["350782"],
    description: "무이산 동목관(桐木關)에서 탄생한 세계 최초의 홍차. 소나무 장작으로 훈연해 송연향(松煙香)과 용안(龍眼) 같은 단맛이 납니다.",
  },
  {
    name_zh: "金骏眉",
    category: "black",
    origins: ["350782"],
    description: "동목관에서 2005년에 개발된 고급 홍차. 싹만 따서 만들며 꿀과 고구마 같은 달콤한 향이 진합니다.",
  },
  {
    name_zh: "祁门红茶",
    category: "black",
    origins: ["341024"],
    description: "세계 3대 홍차로 꼽히는 안후이 기문의 홍차. 난초와 과일을 닮은 ‘기문향(祁門香)’으로 유명합니다.",
  },
  {
    name_zh: "滇红",
    category: "black",
    origins: ["530921"],
    description: "윈난 대엽종으로 만든 홍차. 금빛 싹이 많고 탕색이 붉고 진하며 맛이 두텁습니다.",
  },
  {
    name_zh: "九曲红梅",
    category: "black",
    origins: ["330106"],
    description: "항저우 서호 지역의 홍차. 낚싯바늘처럼 굽은 잎과 붉은 매화 같은 탕색에서 이름이 왔습니다.",
  },
  // 흑차
  {
    name_zh: "普洱茶",
    category: "dark",
    origins: ["530800", "532822"],
    description: "윈난 대엽종 쇄청모차로 만든 차. 자연 숙성한 생차(生茶)와 악퇴 발효한 숙차(熟茶)가 있으며, 오래될수록 가치가 높아집니다.",
  },
  {
    name_zh: "六堡茶",
    category: "dark",
    origins: ["450421"],
    description: "광시 우저우 육보진의 흑차. 빈랑(檳榔) 향이라 불리는 독특한 숙성 향과 붉고 맑은 탕색을 지닙니다.",
  },
  {
    name_zh: "安化黑茶",
    category: "dark",
    origins: ["430923"],
    description: "후난 안화의 흑차. 천량차(千兩茶)·복전차 등 다양한 긴압 형태가 있으며, 옛 차마고도로 북방에 공급되었습니다.",
  },
  {
    name_zh: "茯砖茶",
    category: "dark",
    origins: ["610423"],
    description: "벽돌 모양으로 눌러 만든 흑차. 숙성 중에 피는 노란 ‘금화(金花)’ 균이 품질의 지표입니다.",
  },
];
