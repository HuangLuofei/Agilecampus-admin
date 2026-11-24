export type SidebarGuideStep = {
  id: string;
  title: string;
  description: string;
  selector: string;
};

export const SIDEBAR_GUIDE_STEPS: SidebarGuideStep[] = [
  {
    id: "workbench",
    title: "工作台",
    description: "查看所有小组的项目、待办、动态和临期提醒，也可以按小组筛选工作范围。",
    selector: '[data-guide-id="sidebar-workbench"]',
  },
  {
    id: "tasks",
    title: "我的任务",
    description: "集中查看分配给你的任务，按状态处理待办、进行中和已逾期的工作。",
    selector: '[data-guide-id="sidebar-tasks"]',
  },
  {
    id: "calendar",
    title: "截止日历",
    description: "按日期查看各个项目的截止时间，快速掌握近期需要完成的事项。",
    selector: '[data-guide-id="sidebar-calendar"]',
  },
  {
    id: "templates",
    title: "模板中心",
    description: "浏览并使用项目模板，把常见的课程、活动或团队流程快速创建出来。",
    selector: '[data-guide-id="sidebar-templates"]',
  },
  {
    id: "profile",
    title: "个人信息",
    description: "维护你的姓名、学号和个人展示信息，让队友更容易识别你。",
    selector: '[data-guide-id="sidebar-profile"]',
  },
  {
    id: "messages",
    title: "消息",
    description: "在对话中沟通，在通知中查看任务、项目和团队的最新动态。点击箭头可以展开或收起子菜单。",
    selector: '[data-guide-id="sidebar-messages"]',
  },
  {
    id: "settings",
    title: "设置",
    description: "管理个人访问令牌等账户设置。点击箭头可以展开或收起设置项。",
    selector: '[data-guide-id="sidebar-settings"]',
  },
  {
    id: "teams",
    title: "我的团队",
    description: "展开团队后可以进入投票评审、会议、行动项和团队项目，也可以在底部加入或创建团队。",
    selector: '[data-guide-id="sidebar-team-entry"]',
  },
  {
    id: "guide",
    title: "用户指南",
    description: "随时从这里重新查看本引导，或打开文字版指南了解平台的完整功能。",
    selector: '[data-guide-id="sidebar-guide"]',
  },
];

export const GUIDE_SECTIONS = [
  {
    title: "快速开始",
    items: [
      "注册并登录后，先从侧边栏选择工作台或加入 / 创建团队。",
      "进入团队后，打开项目即可查看任务、文档、时间线和协作工具。",
      "任何页面都可以点击右下角的问号按钮重新打开侧边栏引导。",
    ],
  },
  {
    title: "工作台与任务",
    items: [
      "工作台按团队展示项目概况、最近动态、我的待办和需要关注的事项。",
      "我的任务汇总分配给你的任务，可以按状态筛选并直接进入对应项目。",
      "截止日历按日期展示任务截止时间，支持使用颜色区分不同课程或任务类型。",
    ],
  },
  {
    title: "团队与项目",
    items: [
      "在加入 / 创建团队中创建团队或通过邀请链接加入已有团队。",
      "团队成员页面可以邀请成员、调整成员权限和查看成员信息。",
      "项目页面支持任务看板、迭代、时间线、周报、项目复盘和交付验收。",
      "项目模板可以帮助团队快速建立常用的任务和流程。",
    ],
  },
  {
    title: "文档与文件协作",
    items: [
      "在项目文档中创建、编辑和评论文档，团队成员可以共同维护内容。",
      "资产管理用于集中保存项目文件、链接和资料，并按项目查找。",
      "任务详情中的协作区可以补充讨论、负责人、截止时间和交付信息。",
    ],
  },
  {
    title: "消息与团队协作",
    items: [
      "消息中的对话用于团队沟通，通知用于查看系统和项目动态。",
      "团队投票与评审适合收集意见并形成决定，会议与行动项用于记录会议和后续工作。",
      "项目复盘可以记录做得好的地方、遇到的问题和下一次要改进的行动。",
    ],
  },
  {
    title: "AI 助手",
    items: [
      "在项目 AI 助手中描述项目背景、任务或文档内容，获取拆解建议、总结和下一步行动。",
      "发送给 AI 的内容越具体，得到的结果越容易直接用于项目协作。",
    ],
  },
  {
    title: "个人信息与设置",
    items: [
      "个人信息页面用于维护队友可见的资料。",
      "设置中的访问令牌用于连接支持的外部工具，请只在可信设备上管理。",
    ],
  },
] as const;
