from pydantic import BaseModel, Field
from typing import Literal

### =================================== EXTRACTOR =================================== ###


### =================================== ADVISOR =================================== ###


class AdvisorOutput(BaseModel):
    """
    This is essentially the user details.
    """

    experience: Literal["Beginner", "Intermediate", "Advanced", "Expert"] = Field(
        description="The user's self-assessed proficiency level."
    )
    time: int = Field(
        description="The number of hours per week the user can dedicate to learning."
    )
    learning_goal: str = Field(description="The user's learning goal")
    topic_scope: Literal["narrow", "moderate", "broad"] = Field(
        default="moderate",
        description="The breadth of the user's requested topic (narrow: e.g. React hooks, moderate: e.g. React.js, broad: e.g. Web Development)."
    )
    detail: str = Field(
        description="Any specific context, struggles, goals, or notes the user provided."
    )
    extra_details: dict[str, str | int | float | list | None] = Field(
        default_factory=dict,
        description="Any domain-specific additional fields extracted based on the selected skill."
    )


# class AdvisorOutput(BaseModel):
#     user_details: UserDetail = Field(
#         description="The structured profile breakdown of the user."
#     )


### =================================== PROFESSOR =================================== ###


class Node(BaseModel):
    node_id: int = Field(description="ID of the node")
    name: str = Field(description="Name of the node")
    depth: Literal["CoreNode", "SubNode", "SubSubNode"] = Field(
        description="What level this node is at"
    )
    parent: int | None = Field(description="Parent node id or null if CoreNode")
    progress: Literal["Completed", "In Progress", "Not Started"] = Field(
        description="Current progress level of the node"
    )
    confidence: float = Field(
        description="User selected confidence level", ge=0.0, le=1.0
    )
    prerequisites: list[int] = Field(
        default_factory=list,
        description="List of prerequisite node IDs that must be learned before this node."
    )
    rationale: str = Field(description="One sentence, why this belongs here")
    is_skill_check: bool = Field(
        default=False,
        description="Set to true if this node is generated as a mastered validation challenge/skill check under a completed parent node"
    )


class ProfessorInput(BaseModel):
    """
    For user details, topic and domain etc, we'll embed it as part of the instructions, rather than rely on passing it in as a prompt.
    """

    nodes_list: list[Node] = Field(
        description="The list of nodes after the user has indicated their experience level with each core node"
    )
    sublevel: Literal["SubNode", "SubSubNode"] = Field(
        description="Which sublevel is this?"
    )


class ProfessorOutput(BaseModel):
    nodes_list: list[Node] = Field(description="The list of nodes")


### =================================== LIBRARIAN =================================== ###


class LibrarianInput(BaseModel):
    """
    For user details, topic and domain etc, we'll embed it as part of the instructions, rather than rely on passing it in as a prompt.
    """

    nodes_list: list[Node] = Field(description=("The list of nodes"))


class NodeLink(BaseModel):
    title: str = Field(description="title of the resource")
    why: str = Field(description="one sentence — why this resource suits this user")
    difficulty: Literal["beginner", "intermediate", "advanced"] = Field(
        description="how difficult is this resource"
    )
    resource_type: Literal["video", "article", "course", "documentation", "interactive"] = (
        Field(description="what sort of resource is this")
    )
    link: str = Field(description="url link")
    website: str = Field(description="website of origin, e.g. youtube.com or wikipedia.org")


class NodeMetadata(BaseModel):
    description: str = Field(description="One sentence, why this belongs here")
    resources: list[NodeLink] = Field(description="The resources available here")


class NodeResources(BaseModel):
    """
    We want to reduce the output token used by the models, so instead of returning the whole list of nodes + all the other stuff, we just return the resources only.
    We'll just append the resources to the nodes using node_id using python.
    """

    node_id: int = Field(description="ID of the node")
    metadata: NodeMetadata | None = Field(description="Metadata of the node")


class LibrarianOutput(BaseModel):
    resource_list: list[NodeResources] = Field(
        description="the list of nodes with links"
    )


class NodesWithLinks(Node):
    """
    The nodes that have the metadata attached in python
    """

    metadata: NodeMetadata | None = Field(description="Metadata of the node")


### =================================== TEACHING ASSISTANT =================================== ###


class TeachingAssistantInput(BaseModel):
    """
    Put in only the nodes list without metadata to save input token.
    For user details, topic and domain etc, we'll embed it as part of the instructions, rather than rely on passing it in as a prompt.
    """

    nodes_list: list[Node] = Field(description=("The list of nodes"))


class Tasks(BaseModel):
    task_id: int = Field(description="task id")
    name: str = Field(description="name of the task")
    task: str = Field(description="task description")
    difficulty: Literal["Foundational", "Applied", "Stretch"]
    type: Literal["Build", "Explain", "Analyse", "Research", "Apply"] = Field(
        description="task type"
    )
    estimated_time: int = Field(description="how much time this task would take")


class NodeTasks(BaseModel):
    node_id: int = Field(description="ID of the node")
    task: list[Tasks] = Field(description="The tasks list")


class TeachingAssistantOutput(BaseModel):
    """
    Similar to how we treat resources, we do this to save output tokens
    """

    tasks_list: list[NodeTasks] = Field(description=("The list of nodes"))


class NodesWithTasks(NodesWithLinks):
    """
    The final nodes with resources and tasks
    """

    task: list[Tasks] = Field(description="The tasks list")


### =================================== INQUISITOR =================================== ###


class InquisitorInput(BaseModel):
    """
    For user details, topic and domain etc, we'll embed it as part of the instructions, rather than rely on passing it in as a prompt.
    """

    node: Node = Field(description="The node that the user wants to test themselves on")


class Questions(BaseModel):
    question: str = Field(description="Question text")
    options: list[str] = Field(
        description="List of exactly 4 options for multiple choice questions."
    )
    correct_index: int = Field(
        description="0-based index of the correct option (0, 1, 2, or 3)."
    )
    explanation: str = Field(description="One sentence explanation why this option is correct.")


class InquisitorOutput(BaseModel):
    format: Literal["mcq", "free_form"] = Field(
        description="Select 'free_form' if the task description specifically asks the user to write down, create, draft, build, list, design, prepare, paste, or make something. Select 'mcq' otherwise."
    )
    free_form_prompt: str | None = Field(
        default=None,
        description="If format is 'free_form', provide a specific prompt for the user to write/paste their submission (e.g. 'Please paste your bread recipe and instructions here. Max 300 words.')."
    )
    questions: list[Questions] | None = Field(
        default=None,
        description="If format is 'mcq', provide exactly 3 multiple choice questions."
    )
    summary: list[str] = Field(
        description="Exactly 3-5 short bullet points summarizing the core key concepts tested in these questions (1 sentence each)."
    )


class AdvisorQuestion(BaseModel):
    question: str = Field(description="The question to ask the user.")
    default_answers: list[str] = Field(description="Up to 4 default answers or options for the user.")
